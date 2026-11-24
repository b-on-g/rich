namespace $ {

	const marks: Record< string, $bog_rich_mark > = {
		B: { type: 'bold' },
		STRONG: { type: 'bold' },
		I: { type: 'italic' },
		EM: { type: 'italic' },
		U: { type: 'underline' },
		INS: { type: 'underline' },
		S: { type: 'strikethrough' },
		STRIKE: { type: 'strikethrough' },
		DEL: { type: 'strikethrough' },
		CODE: { type: 'code' },
		KBD: { type: 'code' },
		SAMP: { type: 'code' },
		TT: { type: 'code' },
		'TG-SPOILER': { type: 'spoiler' },
		BLOCKQUOTE: { type: 'blockquote' },
		PRE: { type: 'pre' },
	}

	const skipped = new Set([
		'SCRIPT', 'STYLE', 'TEMPLATE', 'NOSCRIPT', 'IFRAME', 'OBJECT', 'EMBED', 'SVG', 'MATH', 'HEAD', 'TITLE',
		'META', 'LINK', 'IMG', 'PICTURE', 'VIDEO', 'AUDIO', 'CANVAS', 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON',
	])

	const blocks = new Set([
		'P', 'DIV', 'SECTION', 'ARTICLE', 'HEADER', 'FOOTER', 'MAIN', 'ASIDE', 'NAV', 'UL', 'OL', 'LI', 'DL', 'DT', 'DD',
		'TABLE', 'TR', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'PRE', 'HR', 'FIGURE', 'FORM', 'ADDRESS', 'DETAILS', 'SUMMARY',
	])

	const tags: Record< string, string > = {
		bold: 'strong',
		italic: 'em',
		underline: 'u',
		strikethrough: 's',
		code: 'code',
	}

	function marks_of( el: Element ) {

		const res = [] as $bog_rich_mark[]
		const name = el.nodeName.toUpperCase()

		const style = ( el.getAttribute( 'style' ) ?? '' ).toLowerCase()
		const heavy = /font-weight\s*:\s*(bold|[6-9]00)/.test( style )
		const light = /font-weight\s*:\s*(normal|[1-5]00)/.test( style )

		const own = marks[ name ]
		if( own && !( own.type === 'bold' && light ) ) res.push( own )
		if( heavy ) res.push({ type: 'bold' })
		if( /font-style\s*:\s*italic/.test( style ) ) res.push({ type: 'italic' })
		if( /text-decoration[a-z-]*\s*:[^;]*underline/.test( style ) && name !== 'A' ) res.push({ type: 'underline' })
		if( /text-decoration[a-z-]*\s*:[^;]*line-through/.test( style ) ) res.push({ type: 'strikethrough' })

		if( name === 'A' ) {
			const url = $bog_rich_url( el.getAttribute( 'href' ) ?? '' )
			if( url ) res.push({ type: 'text_link', url })
		}

		const kind = el.getAttribute( 'data-bog-rich' )
		if( kind === 'spoiler' || el.classList.contains( 'tg-spoiler' ) ) res.push({ type: 'spoiler' })
		if( kind === 'date_time' ) res.push({
			type: 'date_time',
			timestamp: Number( el.getAttribute( 'data-timestamp' ) || NaN ),
			format: el.getAttribute( 'data-format' ) as $bog_rich_date_format,
			timezone: el.getAttribute( 'data-timezone' ) ?? undefined,
		})

		return res.map( mark => {
			if( mark.type === 'blockquote' && el.hasAttribute( 'data-collapsed' ) ) return { ... mark, collapsed: true }
			if( mark.type === 'pre' && el.getAttribute( 'data-language' ) ) return { ... mark, language: el.getAttribute( 'data-language' )! }
			return mark
		} )
	}

	/** Достаёт из чужой разметки текст и разрешённые стили. Чужие узлы в документ не попадают. */
	export function $bog_rich_html_parse( this: $, html: string ): $bog_rich_content {

		const doc = new this.$mol_dom_context.DOMParser().parseFromString( html, 'text/html' )
		const entities = [] as $bog_rich_entity[]
		let text = ''
		let gap = false
		let started = false

		const put = ( part: string )=> {
			if( gap ) text += '\n'
			gap = false
			started = true
			text += part
		}

		const walk = ( node: Node, pre: boolean )=> {

			if( node.nodeType === 3 ) {

				const raw = node.nodeValue ?? ''
				if( pre ) {
					if( raw ) put( raw )
					return
				}

				const calm = raw.replace( /[ \t\r\n\f]+/g, ' ' )
				const part = gap || !text || /[\s]$/.test( text ) ? calm.replace( /^ /, '' ) : calm
				if( part ) put( part.replaceAll( ' ', ' ' ) )
				return
			}

			if( node.nodeType !== 1 ) return

			const el = node as Element
			const name = el.nodeName.toUpperCase()
			if( skipped.has( name ) ) return

			if( name === 'BR' ) {
				if( el.classList.contains( 'Apple-interchange-newline' ) ) return
				put( '\n' )
				return
			}

			const block = blocks.has( name )
			const keep = pre || name === 'PRE' || /white-space\s*:\s*(pre|break-spaces)/.test( el.getAttribute( 'style' ) ?? '' )

			if( block ) {
				if( !pre ) text = text.replace( / +$/, '' )
				if( started ) gap = true
			}
			if( name === 'LI' ) put( '• ' )

			const size = text.length
			const head = size + ( gap ? 1 : 0 )
			for( const kid of el.childNodes ) walk( kid, keep )

			if( text.length > size && text.length > head ) {
				for( const mark of marks_of( el ) ) entities.push({ ... mark, offset: head, length: text.length - head } as $bog_rich_entity )
			}

			if( block && started ) {
				if( text.endsWith( '\n' ) && text.length > size && !gap ) text = text.slice( 0, -1 )
				gap = true
			}
			if( ( name === 'TD' || name === 'TH' ) && el.nextElementSibling ) put( ' ' )

		}

		for( const kid of doc.body.childNodes ) walk( kid, /white-space\s*:\s*pre/.test( doc.body.getAttribute( 'style' ) ?? '' ) )

		return $bog_rich_normalize({ text, entities })
	}

	/** Безопасная разметка для буфера обмена. */
	export function $bog_rich_html( content: $bog_rich_content ) {

		const escape = ( text: string )=> $mol_html_encode( text ).replaceAll( '\n', '<br>' )

		const draw = ( nodes: readonly $bog_rich_node[] ): string => nodes.map( node => {

			if( typeof node === 'string' ) return escape( node )

			const { mark } = node
			const inner = draw( node.kids )

			switch( mark.type ) {
				case 'text_link': return `<a href="${ $mol_html_encode( mark.url ) }">${ inner }</a>`
				case 'spoiler': return `<span data-bog-rich="spoiler" class="tg-spoiler">${ inner }</span>`
				case 'date_time': return `<span data-bog-rich="date_time" data-timestamp="${ mark.timestamp }" data-format="${ mark.format }"${ mark.timezone ? ` data-timezone="${ $mol_html_encode( mark.timezone ) }"` : '' }>${ inner }</span>`
			}

			return `<${ tags[ mark.type ] }>${ inner }</${ tags[ mark.type ] }>`

		} ).join( '' )

		const body = $bog_rich_blocks( content ).map( block => {
			const { mark } = block
			const code = content.text.slice( block.from, block.to )
			if( mark?.type === 'pre' ) return `<pre${ mark.language ? ` data-language="${ $mol_html_encode( mark.language ) }"` : '' }>${ code.startsWith( '\n' ) ? '\n' : '' }${ $mol_html_encode( code ) }${ code.endsWith( '\n' ) ? '\n' : '' }</pre>`
			const lines = code.split( '\n' )
			let pos = block.from
			const inner = lines.map( line => {
				const from = pos
				pos += line.length + 1
				return `<div>${ draw( $bog_rich_tree( content, from, from + line.length ) ) || '<br>' }</div>`
			} ).join( '' )
			return mark?.type === 'blockquote' ? `<blockquote${ mark.collapsed ? ' data-collapsed' : '' }>${ inner }</blockquote>` : inner
		} )

		return `<div style="white-space: pre-wrap">${ body.join( '' ) }</div>`
	}

}
