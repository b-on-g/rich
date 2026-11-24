namespace $.$$ {

	export type $bog_rich_edit_range = { anchor: number, focus: number }

	export type $bog_rich_edit_command = $bog_rich_type | 'clear' | 'collapse' | 'leave'

	type Shot = { content: $bog_rich_content, range: $bog_rich_edit_range }

	const commands: readonly $bog_rich_edit_command[] = [
		'bold', 'italic', 'underline', 'strikethrough', 'blockquote', 'code', 'pre', 'spoiler', 'text_link', 'date_time', 'clear',
	]

	const keys: Partial< Record< $bog_rich_edit_command, string > > = {
		bold: 'ctrl_B',
		italic: 'ctrl_I',
		underline: 'ctrl_U',
		strikethrough: 'ctrl_shift_X',
		blockquote: 'ctrl_shift_period',
		code: 'ctrl_shift_M',
		spoiler: 'ctrl_shift_P',
		text_link: 'ctrl_K',
		date_time: 'ctrl_shift_D',
		clear: 'ctrl_shift_N',
	}

	const native: Record< string, $bog_rich_style > = {
		formatBold: 'bold',
		formatItalic: 'italic',
		formatUnderline: 'underline',
		formatStrikeThrough: 'strikethrough',
	}

	const mime = 'application/x-bog-rich'

	export class $bog_rich_edit extends $.$bog_rich_edit {

		@ $mol_mem
		override content( next?: $bog_rich_content ): $bog_rich_content {
			return next ?? $bog_rich_empty
		}

		@ $mol_mem
		model() {
			return $bog_rich_normalize( this.content() )
		}

		last = null as null | $bog_rich_content
		range = { anchor: 0, focus: 0 } as $bog_rich_edit_range
		typing = null as null | readonly $bog_rich_mark[]
		typing_at = -1
		composing = false

		@ $mol_memo.method
		story() {
			const story = new $bog_rich_story< Shot >( shot => { this.shot( shot ) } )
			story.$ = this.$
			return story
		}

		override destructor() {
			this.story().clear()
			super.destructor()
		}

		override editable() {
			return this.enabled() ? 'true' : 'false'
		}

		root() {
			return this.Content().dom_node() as HTMLElement
		}

		document() {
			return this.$.$mol_dom_context.document
		}

		@ $mol_mem
		override sub() {
			return [
				... this.model().text ? [] : [ this.Hint() ],
				this.Content(),
				... this.enabled() ? [ this.Menu() ] : [],
			]
		}

		@ $mol_mem
		override drawn() {

			const content = this.model()
			const root = this.root()
			const known = this.last && $bog_rich_equal( content, this.last )

			if( !known ) this.adopt( content )
			if( this.composing ) return null as any

			const held = this.held()
			if( $bog_rich_dom_draw( root, content ) && held ) this.place()

			return null as any
		}

		adopt( content: $bog_rich_content ) {
			this.last = content
			this.composing = false
			this.typing = null
			this.range = { anchor: content.text.length, focus: content.text.length }
			this.story().clear()
			if( $mol_wire_probe( ()=> this.menu_showed() ) ) new this.$.$mol_after_tick( ()=> this.menu_showed( false ) )
		}

		@ $mol_mem
		selection_sync() {
			return new this.$.$mol_dom_listener( this.document(), 'selectionchange', ()=> this.track() )
		}

		override auto() {
			return [ this.selection_sync() ] as any
		}

		held() {
			const root = this.root()
			const active = this.document().activeElement
			return active === root
		}

		read_range( map: $bog_rich_dom_map ): $bog_rich_edit_range | null {

			const root = this.root()
			const sel = this.document().getSelection()
			if( !sel?.rangeCount || !root.contains( sel.anchorNode ) || !root.contains( sel.focusNode ) ) return null

			const spot = ( node: Node, pos: number )=> $bog_rich_dom_offset( map, root, node, pos )
			return { anchor: spot( sel.anchorNode!, sel.anchorOffset ), focus: spot( sel.focusNode!, sel.focusOffset ) }
		}

		track() {

			if( this.composing ) return

			const map = $bog_rich_dom_read( this.root() )
			if( map.text !== this.last?.text ) return

			const range = this.read_range( map )
			if( !range ) return

			if( range.anchor !== this.range.anchor || range.focus !== this.range.focus ) {
				if( range.focus !== this.typing_at || range.anchor !== range.focus ) this.typing = null
				if( !this.menu_list() || !this.menu_showed() ) this.story().seal()
			}

			this.range = range

		}

		/** Логическое выделение с направлением. */
		selection( next?: $bog_rich_edit_range ) {

			if( next ) {
				const max = this.model().text.length
				const fit = ( pos: number )=> Math.max( 0, Math.min( max, pos ) )
				this.range = { anchor: fit( next.anchor ), focus: fit( next.focus ) }
				this.typing = null
				if( this.held() ) this.place()
			}

			return this.range
		}

		ends() {
			const max = this.model().text.length
			const { anchor, focus } = this.range
			return [ Math.min( anchor, focus, max ), Math.min( Math.max( anchor, focus ), max ) ] as const
		}

		place() {

			const root = this.root()
			const map = $bog_rich_dom_read( root )
			const sel = this.document().getSelection()
			if( !sel ) return

			const from = $bog_rich_dom_point( map, root, this.range.anchor )
			const to = $bog_rich_dom_point( map, root, this.range.focus )

			sel.setBaseAndExtent( from[0], from[1], to[0], to[1] )
		}

		refocus() {
			this.root().focus({ preventScroll: true })
			this.place()
		}

		/** Ставит фокус и каретку на прежнее место. */
		override bring() {
			this.Content().bring()
			new this.$.$mol_after_timeout( 0, ()=> new this.$.$mol_after_frame( ()=> {
				if( this.held() ) this.place()
			} ) )
		}

		shot( next?: Shot ): Shot {

			if( next ) {
				this.last = next.content
				this.range = next.range
				this.typing = null
				this.composing = false
				this.content( next.content )
				this.redraw()
			}

			return { content: this.model(), range: this.range }
		}

		redraw() {
			const held = this.held()
			$bog_rich_dom_draw( this.root(), this.last ?? this.model() )
			if( held ) this.place()
		}

		push( next: $bog_rich_content, range: $bog_rich_edit_range ) {

			const prev = this.shot()

			if( !$bog_rich_equal( prev.content, next ) ) {
				this.story().stage( prev, { content: next, range } )
				this.last = next
				this.content( next )
			}

			this.range = range
		}

		/** Отдельная операция: своя запись в истории и перерисовка. */
		step( next: $bog_rich_content, range: $bog_rich_edit_range ) {
			this.composing = false
			this.story().seal()
			this.push( next, range )
			this.story().seal()
			this.redraw()
		}

		undo() {
			this.story().backward()
			return null
		}

		redo() {
			this.story().forward()
			return null
		}

		room( from: number, to: number ) {
			return Math.max( 0, this.length_max() - this.model().text.length + to - from )
		}

		marks( from: number, to: number ) {
			return this.typing ?? $bog_rich_typing( this.model(), from, to )
		}

		written( from: number, to: number, insert: string ) {

			const edge = from + insert.length
			const marks = this.marks( from, to )
			let next = $bog_rich_replace( this.model(), from, to, insert, marks.filter( mark => mark.type !== 'pre' && mark.type !== 'blockquote' ) )

			if( !insert || !this.typing ) return next

			for( const type of $bog_rich_toggles ) {
				if( !this.typing.some( mark => mark.type === type ) ) next = $bog_rich_remove( next, type, from, edge )
			}
			const spoiler = this.typing.some( mark => mark.type === 'spoiler' )
				&& this.model().entities.find( mark => mark.type === 'spoiler' && mark.offset + mark.length === from )
			if( spoiler ) next = $bog_rich_apply( next, { type: 'spoiler' }, spoiler.offset, edge )

			for( const mark of this.typing ) {
				if( mark.type === 'pre' || mark.type === 'blockquote' ) next = $bog_rich_apply( next, mark, from, edge )
			}

			return next
		}

		keep_typing( pos: number ) {
			this.typing = this.typing?.filter( mark => mark.type !== 'pre' && mark.type !== 'blockquote' ) ?? null
			this.typing_at = pos
		}

		/** Заменяет диапазон текстом с текущими стилями набора. */
		write( from: number, to: number, text: string ) {

			const [ head, tail ] = $bog_rich_whole( this.model(), from, to )
			const insert = $bog_rich_fit( text, this.room( head, tail ) )
			if( !insert && head === tail ) return

			const pos = head + insert.length
			const next = this.written( head, tail, insert )

			this.composing = false
			this.keep_typing( pos )
			this.push( next, { anchor: pos, focus: pos } )
			this.redraw()
		}

		sync() {

			const root = this.root()
			const map = $bog_rich_dom_read( root )
			const prev = this.model()
			const range = this.read_range( map ) ?? { anchor: map.text.length, focus: map.text.length }

			if( map.text === prev.text ) {
				this.range = range
			} else {

				const { from, to, insert } = $bog_rich_diff( prev.text, map.text, range.focus )
				const fit = this.composing ? insert : $bog_rich_fit( insert, this.room( from, to ) )
				const shift = ( pos: number )=> pos > from + fit.length ? Math.max( from + fit.length, pos - insert.length + fit.length ) : pos
				const next = this.written( from, to, fit )
				const caret = { anchor: shift( range.anchor ), focus: shift( range.focus ) }

				this.keep_typing( caret.focus )
				this.push( next, caret )

			}

			if( !this.composing ) this.redraw()
		}

		override typed( event?: InputEvent ) {
			if( event?.isComposing ) this.composing = true
			this.sync()
			return null
		}

		override compose_start( event?: Event ) {

			const [ from, to ] = this.ends()
			const { text } = this.model()
			if( from < to && ( text.slice( from, to ).includes( '\n' ) || this.atom_hit( from, to ) ) ) this.write( from, to, '' )

			this.composing = true
			return null
		}

		override compose_end( event?: Event ) {
			this.composing = false
			this.sync()
			return null
		}

		atom_hit( from: number, to: number ) {
			return this.model().entities.some( mark => mark.type === 'date_time' && mark.offset <= to && mark.offset + mark.length >= from )
		}

		target( event: InputEvent ) {

			const range = event.getTargetRanges?.()[0]
			const root = this.root()
			if( !range || !root.contains( range.startContainer ) || !root.contains( range.endContainer ) ) return this.ends()

			const map = $bog_rich_dom_read( root )
			return [
				$bog_rich_dom_offset( map, root, range.startContainer, range.startOffset ),
				$bog_rich_dom_offset( map, root, range.endContainer, range.endOffset ),
			] as const
		}

		override before( event?: InputEvent ) {

			if( !event ) return null
			const type = event.inputType

			if( !this.enabled() ) {
				event.preventDefault()
				return null
			}

			if( type === 'historyUndo' || type === 'historyRedo' ) {
				event.preventDefault()
				return type === 'historyUndo' ? this.undo() : this.redo()
			}

			if( type.startsWith( 'format' ) ) {
				event.preventDefault()
				if( native[ type ] ) this.format_apply( native[ type ] )
				return null
			}

			if( type === 'insertFromPaste' || type === 'insertFromPasteAsQuotation' || type === 'deleteByCut' ) {
				event.preventDefault()
				return null
			}

			if( type === 'insertParagraph' || type === 'insertLineBreak' ) {
				event.preventDefault()
				this.newline()
				return null
			}

			if( event.isComposing || type === 'insertCompositionText' || !event.cancelable ) return null

			const [ from, to ] = this.target( event )

			if( type === 'insertFromDrop' || type === 'insertFromYank' ) {
				event.preventDefault()
				this.range = { anchor: from, focus: to }
				const data = event.dataTransfer
				this.insert( data ? this.take( data ) : { text: event.data ?? '', entities: [] }, false )
				return null
			}

			const { text } = this.model()
			const data = event.data ?? event.dataTransfer?.getData( 'text/plain' ) ?? ''
			const wide = text.slice( from, to ).includes( '\n' ) || data.includes( '\n' ) || this.atom_hit( from, to )
			const over = type.startsWith( 'insert' ) && data.length > this.room( from, to )

			if( !wide && !over && !( type.startsWith( 'delete' ) && from === to ) ) return null

			event.preventDefault()

			if( type.startsWith( 'insert' ) ) this.write( from, to, data )
			else if( from < to ) this.write( from, to, '' )
			else {
				const pos = $bog_rich_grapheme( text, from, type.endsWith( 'Forward' ) ? 1 : -1 )
				if( pos !== from ) this.write( Math.min( from, pos ), Math.max( from, pos ), '' )
				else this.unbox( from )
			}

			return null
		}

		unbox( pos: number ) {
			for( const type of [ 'blockquote', 'pre' ] as const ) {
				if( $bog_rich_at( this.model(), type, pos ) ) this.step( $bog_rich_remove( this.model(), type, pos, pos ), this.range )
			}
		}

		newline() {

			const [ from, to ] = this.ends()
			const content = this.model()
			const quote = $bog_rich_at( content, 'blockquote', from, to )
			const line = $bog_rich_line( content.text, from )

			if( from === to && quote && line[0] === line[1] && quote.offset + quote.length === from ) {
				this.step( $bog_rich_remove( content, 'blockquote', from, from ), { anchor: from, focus: from } )
				return
			}

			this.typing = null
			this.write( from, to, '\n' )
		}

		/** Выводит каретку из цитаты или кода в обычный абзац. */
		leave() {

			const content = this.model()
			const [ , pos ] = this.ends()
			const box = $bog_rich_at( content, 'pre', pos ) ?? $bog_rich_at( content, 'blockquote', pos )
			if( !box ) return null

			const edge = box.offset + box.length
			const caret = { anchor: edge + 1, focus: edge + 1 }

			if( content.text[ edge ] === '\n' ) {
				this.selection( caret )
				return null
			}

			const grown = $bog_rich_replace( content, edge, edge, '\n' )
			this.step( $bog_rich_remove( grown, box.type, edge + 1, edge + 1 ), caret )

			return null
		}

		override copy( event?: ClipboardEvent ) {

			const [ from, to ] = this.ends()
			const data = event?.clipboardData
			if( !data || from === to ) return null

			const part = $bog_rich_slice( this.model(), from, to )
			event.preventDefault()
			data.setData( 'text/plain', part.text )
			data.setData( 'text/html', $bog_rich_html( part ) )
			data.setData( mime, JSON.stringify( part ) )

			return null
		}

		override cut( event?: ClipboardEvent ) {

			const [ from, to ] = this.ends()
			this.copy( event )

			if( from < to && this.enabled() && event?.defaultPrevented ) {
				this.story().seal()
				this.write( from, to, '' )
				this.story().seal()
			}

			return null
		}

		take( data: DataTransfer ): $bog_rich_content {

			const own = data.getData( mime )
			if( own ) {
				const content = $mol_try( ()=> $bog_rich_normalize( JSON.parse( own ) ) )
				if( !( content instanceof Error ) && content.text ) return content
			}

			const html = data.getData( 'text/html' )
			const content = html ? this.$.$bog_rich_html_parse( html ) : $bog_rich_empty
			if( content.entities.length ) return content

			return { text: ( data.getData( 'text/plain' ) || content.text ).replace( /\r\n?/g, '\n' ), entities: [] }
		}

		insert( part: $bog_rich_content, link: boolean ) {

			const content = this.model()
			const [ from, to ] = $bog_rich_whole( content, ... this.ends() )

			const url = link && from < to && !/\s/.test( part.text.trim() ) && /^https?:\/\//i.test( part.text.trim() ) ? $bog_rich_url( part.text ) : ''
			if( url && $bog_rich_state_of( content, 'text_link', from, to ) !== 'disabled' ) {
				this.step( $bog_rich_apply( content, { type: 'text_link', url }, from, to ), this.range )
				return
			}

			this.story().seal()

			if( !part.entities.length ) this.write( from, to, part.text )
			else {
				const fit = $bog_rich_slice( part, 0, $bog_rich_fit( part.text, this.room( from, to ) ).length )
				const pos = from + fit.text.length
				this.step( $bog_rich_insert( content, from, to, fit ), { anchor: pos, focus: pos } )
			}

			this.story().seal()
		}

		override paste( event?: ClipboardEvent ) {

			const data = event?.clipboardData
			if( !data || !this.enabled() ) return null

			const part = this.take( data )

			if( !part.text ) {
				if( data.files.length ) this.paste_files( data.files )
				return null
			}

			event.preventDefault()
			event.stopPropagation()
			this.insert( part, true )

			return null
		}

		/** Состояние команды для текущего выделения. */
		format_state( type: $bog_rich_type ): $bog_rich_state {

			const content = this.model()
			const [ from, to ] = this.ends()
			const state = $bog_rich_state_of( content, type, from, to )

			if( from < to || state === 'disabled' || type === 'date_time' || type === 'text_link' ) return state
			if( this.typing && ( $bog_rich_toggles.includes( type ) || state === 'off' ) ) return this.typing.some( mark => mark.type === type ) ? 'on' : 'off'
			if( !$bog_rich_toggles.includes( type ) ) return state

			return this.marks( from, to ).some( mark => mark.type === type ) ? 'on' : 'off'
		}

		/** Применяет или снимает стиль на выделении, без выделения меняет стиль набора. */
		format_apply( type: Exclude< $bog_rich_type, 'text_link' | 'date_time' > ) {

			if( !this.enabled() ) return null
			const state = this.format_state( type )
			if( state === 'disabled' ) return null

			const content = this.model()
			const [ from, to ] = this.ends()
			const mark = { type } as $bog_rich_mark
			const inline = $bog_rich_toggles.includes( type )
			const line = $bog_rich_line( content.text, from )
			const blank = from === to && line[0] === line[1] && !$bog_rich_at( content, type, from )

			if( from === to && ( inline || blank ) ) {

				const clash = ( item: $bog_rich_mark )=> inline && ( type === 'code' || item.type === 'code' ) && item.type !== 'blockquote'
				const rest = this.marks( from, to ).filter( item => item.type !== type && item.type !== 'text_link' && !clash( item ) && ( inline || $bog_rich_toggles.includes( item.type ) ) )

				this.typing = state === 'on' ? rest : [ ... rest, mark ]
				this.typing_at = from
				return null
			}

			this.step( state === 'on' ? $bog_rich_remove( content, type, from, to ) : $bog_rich_apply( content, mark, from, to ), this.range )

			return null
		}

		format_clear() {

			const [ from, to ] = this.ends()

			if( from === to ) {
				this.typing = []
				this.typing_at = from
			} else {
				this.step( $bog_rich_clear( this.model(), from, to ), this.range )
			}

			return null
		}

		collapse() {

			const content = this.model()
			const quote = $bog_rich_at( content, 'blockquote', ... this.ends() )
			if( quote?.type !== 'blockquote' ) return null

			const entities = content.entities.map( mark => mark === quote ? { ... quote, collapsed: !quote.collapsed } : mark )
			this.step( $bog_rich_normalize({ text: content.text, entities }), this.range )

			return null
		}

		box() {
			const [ from, to ] = this.ends()
			return $bog_rich_at( this.model(), 'pre', from, to ) ?? $bog_rich_at( this.model(), 'blockquote', from, to )
		}

		run( id: $bog_rich_edit_command ) {

			if( !this.enabled() || this.state( id ) === 'disabled' ) return false

			switch( id ) {
				case 'text_link': this.link_open(); break
				case 'date_time': this.date_open(); break
				case 'clear': this.format_clear(); break
				case 'collapse': this.collapse(); break
				case 'leave': this.leave(); break
				default: this.format_apply( id )
			}

			return true
		}

		state( id: $bog_rich_edit_command ): $bog_rich_state {

			const [ from, to ] = this.ends()

			if( id === 'clear' ) {
				const able = from < to ? $bog_rich_clear_able( this.model(), from, to ) : this.marks( from, to ).length > 0
				return able ? 'off' : 'disabled'
			}

			if( id === 'leave' ) return this.box() ? 'off' : 'disabled'

			if( id === 'collapse' ) {
				const box = this.box()
				return box?.type === 'blockquote' ? box.collapsed ? 'on' : 'off' : 'disabled'
			}

			return this.format_state( id )
		}

		@ $mol_mem
		override hotkeys() {

			const res = {} as Record< string, ( event: KeyboardEvent )=> void >
			const bind = ( key: string, task: ( event: KeyboardEvent )=> boolean )=> {
				res[ key ] = event => { if( task( event ) ) event.preventDefault() }
			}

			for( const id of commands ) {
				const key = keys[ id ]
				if( key ) bind( key, ()=> this.run( id ) )
			}

			const history = ( task: ()=> void )=> ()=> {
				if( this.enabled() ) task()
				return true
			}
			bind( 'ctrl_Z', history( ()=> this.undo() ) )
			bind( 'ctrl_shift_Z', history( ()=> this.redo() ) )
			bind( 'ctrl_Y', history( ()=> this.redo() ) )

			const wrap = ()=> {
				if( !this.enabled() ) return false
				this.newline()
				return true
			}
			bind( 'ctrl_enter', wrap )
			bind( 'alien_enter', wrap )

			bind( 'enter', event => {
				const [ from, to ] = this.ends()
				if( !this.enabled() || !this.submit_with_enter() || $bog_rich_at( this.model(), 'pre', from, to ) ) return false
				if( this.typing?.some( mark => mark.type === 'pre' ) ) return false
				this.submit( event )
				return true
			} )

			bind( 'tab', ()=> {
				const [ from, to ] = this.ends()
				if( !this.enabled() || !$bog_rich_at( this.model(), 'pre', from, to ) ) return false
				this.write( from, to, '\t' )
				return true
			} )

			bind( 'down', ()=> {
				const [ from, to ] = this.ends()
				const pre = $bog_rich_at( this.model(), 'pre', to )
				const { text } = this.model()
				if( from !== to || !pre || pre.offset + pre.length !== text.length ) return false
				if( text.slice( to ).includes( '\n' ) ) return false
				this.leave()
				return true
			} )

			return res as any
		}

		@ $mol_mem
		mode( next?: 'list' | 'link' | 'date' ) {
			return next ?? 'list'
		}

		override menu_list() {
			return this.mode() === 'list' || !this.menu_showed()
		}

		override menu_content() {
			return [ this.mode() === 'link' ? this.Link_form() : this.mode() === 'date' ? this.Date_form() : this.Commands() ]
		}

		menu_open( mode: 'list' | 'link' | 'date', spot: any = null ) {
			this.mode( mode )
			this.menu_spot( spot )
			this.menu_showed( true )
		}

		override menu_toggle( event?: Event ) {

			if( this.menu_showed() ) return this.menu_close()

			this.menu_open( 'list' )
			const first = this.command_items()[0]
			if( event?.type === 'keydown' && first ) first.focused( true )

			return null
		}

		override menu_close( event?: Event ) {
			const inside = this.Menu().dom_node().contains( this.document().activeElement )
			this.menu_showed( false )
			if( inside || event ) this.refocus()
			return null
		}

		override context( event?: PointerEvent ) {

			if( !event || !this.enabled() ) return null
			if( event.pointerType ? event.pointerType !== 'mouse' : !this.$.$mol_media.match( '(pointer: fine)' ) ) return null

			const [ from, to ] = this.ends()
			if( from === to ) return null

			event.preventDefault()
			const { clientX: x, clientY: y } = event
			this.menu_open( 'list', { left: x, right: x, top: y, bottom: y, width: 0, height: 0 } )

			return null
		}

		@ $mol_mem
		command_ids() {
			this.menu_showed()
			const box = this.box()
			return [
				... commands.slice( 0, -1 ),
				... box?.type === 'blockquote' ? [ 'collapse' as const ] : [],
				... box ? [ 'leave' as const ] : [],
				'clear' as const,
			]
		}

		override command_items() {
			return this.command_ids().map( id => this.Command( id ) )
		}

		@ $mol_mem
		override command_focused( next?: $mol_view ) {
			if( next ) next.focused( true )
			return next ?? this.command_items().find( item => item.focused() ) ?? null
		}

		@ $mol_mem_key
		override command_state( id: $bog_rich_edit_command ) {
			this.menu_showed()
			return this.state( id )
		}

		override command_enabled( id: $bog_rich_edit_command ) {
			return this.command_state( id ) !== 'disabled'
		}

		override command_checked( id: $bog_rich_edit_command ) {
			const state = this.command_state( id )
			return state === 'on' ? 'true' : state === 'mixed' ? 'mixed' : 'false'
		}

		override command_split( id: $bog_rich_edit_command ) {
			return id === 'text_link' || id === 'clear'
		}

		override command_icon( id: $bog_rich_edit_command ) {
			return [ this[ `Icon_${ id }` ]() ]
		}

		override command_label( id: $bog_rich_edit_command ) {
			return this.labels()[ id ]
		}

		override command_key( id: $bog_rich_edit_command ) {

			const key = keys[ id ]
			if( !key || !this.$.$mol_media.match( '(any-hover: hover)' ) ) return ''

			const mac = this.Hotkey().mac()
			const names: Record< string, string > = { ctrl: mac ? '⌘' : 'Ctrl', shift: mac ? '⇧' : 'Shift', period: '.' }

			return key.split( '_' ).map( part => names[ part ] ?? part ).join( mac ? '' : '+' )
		}

		override command_click( id: $bog_rich_edit_command, event?: Event ) {

			const inside = this.Menu().dom_node().contains( this.document().activeElement )
			const form = id === 'text_link' || id === 'date_time'

			if( !form ) this.menu_showed( false )
			this.run( id )
			if( !form && ( inside || this.held() ) ) this.refocus()

			return null
		}

		form = { content: $bog_rich_empty, from: 0, to: 0 }

		form_begin( type: 'text_link' | 'date_time' ) {

			const content = this.model()
			const [ from, to ] = this.ends()
			const mark = $bog_rich_at( content, type, from, to )
			const [ head, tail ] = mark ? [ mark.offset, mark.offset + mark.length ] : $bog_rich_whole( content, from, to )

			this.form = { content, from: head, to: tail }

			return mark
		}

		form_valid() {
			return $bog_rich_equal( this.form.content, this.model() )
		}

		form_end( next: $bog_rich_content, range: $bog_rich_edit_range ) {
			this.menu_showed( false )
			this.step( next, range )
			this.refocus()
		}

		form_put( text: string, mark: $bog_rich_mark ) {

			if( !this.form_valid() ) {
				this.menu_close()
				return
			}

			const { content, from, to } = this.form
			const fit = $bog_rich_fit( text, this.room( from, to ) )
			if( !fit || mark.type === 'date_time' && fit !== text ) return

			const same = fit === content.text.slice( from, to )
			const base = same ? content : $bog_rich_replace( content, from, to, fit, mark.type === 'date_time' ? [] : $bog_rich_typing( content, from, to ) )
			const edge = from + fit.length

			this.typing = null
			this.form_end( $bog_rich_apply( base, mark, from, edge ), { anchor: edge, focus: edge } )
		}

		link_open() {

			const mark = this.form_begin( 'text_link' )
			const { content, from, to } = this.form

			this.link_text( content.text.slice( from, to ) )
			this.link_url( mark?.type === 'text_link' ? mark.url : '' )
			this.menu_open( 'link', this.menu_showed() ? this.menu_spot() : null )

			const field = from < to ? this.Link_url() : this.Link_text()
			field.focused( true )
		}

		override link_bid() {
			return this.link_url() && !$bog_rich_url( this.link_url() ) ? this.link_wrong() : ''
		}

		override link_ready() {
			return Boolean( this.link_text().trim() && $bog_rich_url( this.link_url() ) )
		}

		@ $mol_action
		override link_apply( event?: Event ) {
			const url = $bog_rich_url( this.link_url() )
			event?.preventDefault()
			if( this.link_ready() ) this.form_put( this.link_text(), { type: 'text_link', url } )
			return null
		}

		override link_tools() {
			return [
				this.Link_apply(),
				... this.menu_showed() && $bog_rich_at( this.form.content, 'text_link', this.form.from, this.form.to ) ? [ this.Link_remove() ] : [],
				this.Cancel(),
			]
		}

		@ $mol_action
		override link_remove( event?: Event ) {
			const { content, from, to } = this.form
			if( this.form_valid() ) this.form_end( $bog_rich_remove( content, 'text_link', from, to ), { anchor: to, focus: to } )
			else this.menu_close()
			return null
		}

		lang() {
			return this.$.$mol_locale.lang()
		}

		date_open() {

			const mark = this.form_begin( 'date_time' )
			const { content, from, to } = this.form
			const zone = mark?.type === 'date_time' && mark.timezone || $bog_rich_zone_own()
			const stamp = mark?.type === 'date_time' ? mark.timestamp : Math.ceil( Date.now() / 3600000 ) * 3600
			const parts = $bog_rich_zone_parts( stamp, zone )
			const two = ( num: number )=> String( num ).padStart( 2, '0' )

			this.date_zone( zone )
			this.date_moment( `${ parts.year }-${ two( parts.month ) }-${ two( parts.day ) } ${ two( parts.hour ) }:${ two( parts.minute ) }` )
			this.date_twin( String( Math.max( 0, $bog_rich_zone_moments( parts, zone ).indexOf( stamp ) ) ) )
			this.date_format( mark?.type === 'date_time' ? mark.format : from < to ? 'text' : 'datetime' )
			this.date_text( content.text.slice( from, to ) )
			this.menu_open( 'date', this.menu_showed() ? this.menu_spot() : null )

		}

		override date_zones() {
			return $bog_rich_zone_list()
		}

		@ $mol_mem
		date_moments() {

			const found = /^(\d{4})-(\d\d)-(\d\d)(?:[ T](\d\d):(\d\d))?/.exec( this.date_moment() )
			if( !found ) return []

			const [ year, month, day, hour, minute ] = found.slice( 1 ).map( part => Number( part ?? 0 ) )
			return $bog_rich_zone_moments( { year, month, day, hour, minute, second: 0 }, this.date_zone() || $bog_rich_zone_own() )
		}

		override date_bid() {
			if( !/^\d{4}-\d\d-\d\d/.test( this.date_moment() ) ) return this.date_wrong()
			return this.date_moments().length ? '' : this.date_missing()
		}

		override date_twins() {
			return Object.fromEntries( this.date_moments().map( ( moment, index )=> [
				String( index ),
				$bog_rich_zone_full( moment, this.lang(), this.date_zone() ),
			] ) ) as any
		}

		stamp() {
			const list = this.date_moments()
			return list[ Number( this.date_twin() ) ] ?? list[0]
		}

		@ $mol_mem
		override date_formats() {
			const stamp = this.stamp() ?? 0
			const now = Math.floor( Date.now() / 1000 )
			return Object.fromEntries( $bog_rich_date_formats.map( format => [
				format,
				format === 'text' ? this.date_own() : $bog_rich_zone_text( stamp, format, this.lang(), now, this.date_zone() || undefined ),
			] ) ) as any
		}

		override date_rows() {
			return [
				this.Date_moment_field(),
				this.Date_zone_field(),
				... this.date_moments().length > 1 ? [ this.Date_twin_field() ] : [],
				this.Date_format_field(),
				... this.date_format() === 'text' ? [ this.Date_text_field() ] : [],
				this.Date_tools(),
			]
		}

		date_label() {
			const format = this.date_format() as $bog_rich_date_format
			if( format === 'text' ) return this.date_text().replace( /\s+/g, ' ' ).trim()
			return $bog_rich_zone_text( this.stamp(), format === 'relative' ? 'datetime' : format, this.lang(), 0, this.date_zone() )
		}

		override date_ready() {
			return Boolean( this.date_moments().length && this.date_label() )
		}

		@ $mol_action
		override date_apply( event?: Event ) {

			if( !this.date_ready() ) return null

			this.form_put( this.date_label(), {
				type: 'date_time',
				timestamp: this.stamp(),
				format: this.date_format() as $bog_rich_date_format,
				timezone: this.date_zone(),
			} )

			return null
		}

		override date_tools() {
			return [
				this.Date_apply(),
				... this.menu_showed() && $bog_rich_at( this.form.content, 'date_time', this.form.from, this.form.to ) ? [ this.Date_remove() ] : [],
				this.Cancel(),
			]
		}

		@ $mol_action
		override date_remove( event?: Event ) {
			const { content, from, to } = this.form
			if( this.form_valid() ) this.form_end( $bog_rich_remove( content, 'date_time', from, to ), { anchor: to, focus: to } )
			else this.menu_close()
			return null
		}

	}

}
