namespace $ {

	export type $bog_rich_style = 'bold' | 'italic' | 'underline' | 'strikethrough'

	export type $bog_rich_date_format = 'date_short' | 'date_full' | 'time_short' | 'time_full' | 'weekday' | 'datetime' | 'relative' | 'text'

	export type $bog_rich_mark =
		| { type: $bog_rich_style | 'spoiler' | 'code' }
		| { type: 'blockquote', collapsed?: boolean }
		| { type: 'pre', language?: string }
		| { type: 'text_link', url: string }
		| { type: 'date_time', timestamp: number, format: $bog_rich_date_format, timezone?: string }

	export type $bog_rich_entity = { offset: number, length: number } & $bog_rich_mark

	export type $bog_rich_type = $bog_rich_entity[ 'type' ]

	export type $bog_rich_content = {
		text: string
		entities: readonly $bog_rich_entity[]
	}

	export type $bog_rich_state = 'on' | 'off' | 'mixed' | 'disabled'

	export type $bog_rich_node = string | {
		key: string
		from: number
		to: number
		mark: $bog_rich_entity
		index: number
		kids: readonly $bog_rich_node[]
	}

	export type $bog_rich_block = {
		type: 'text' | 'blockquote' | 'pre'
		from: number
		to: number
		mark: $bog_rich_entity | null
	}

	export const $bog_rich_empty: $bog_rich_content = { text: '', entities: [] }

	export const $bog_rich_styles: readonly $bog_rich_style[] = [ 'bold', 'italic', 'underline', 'strikethrough' ]

	export const $bog_rich_toggles: readonly $bog_rich_type[] = [ ... $bog_rich_styles, 'spoiler', 'code' ]

	export const $bog_rich_date_formats: readonly $bog_rich_date_format[] = [
		'datetime', 'date_short', 'date_full', 'time_short', 'time_full', 'weekday', 'relative', 'text',
	]

	const order: readonly $bog_rich_type[] = [
		'pre', 'blockquote', 'spoiler', 'text_link', 'bold', 'italic', 'underline', 'strikethrough', 'code', 'date_time',
	]

	type Range = readonly[ from: number, to: number ]

	function end( entity: $bog_rich_entity ) {
		return entity.offset + entity.length
	}

	function place< Entity extends $bog_rich_mark >( mark: Entity, from: number, to: number ) {
		return { ... mark, offset: from, length: to - from } as Entity & $bog_rich_entity
	}

	function subtract( range: Range, holes: readonly Range[] ) {

		let parts = [ range ] as Range[]

		for( const [ from, to ] of holes ) {
			parts = parts.flatMap( ([ head, tail ])=> to <= head || from >= tail ? [ [ head, tail ] as Range ] : [
				[ head, Math.max( head, from ) ] as Range,
				[ Math.min( tail, to ), tail ] as Range,
			] )
		}

		return parts.filter( ([ head, tail ])=> head < tail )
	}

	function merge( ranges: readonly Range[], touch: boolean ) {

		const res = [] as [ number, number ][]

		for( const [ from, to ] of [ ... ranges ].sort( ( a, b )=> a[0] - b[0] || a[1] - b[1] ) ) {
			const last = res.at( -1 )
			if( last && ( touch ? from <= last[1] : from < last[1] ) ) last[1] = Math.max( last[1], to )
			else res.push([ from, to ])
		}

		return res as readonly Range[]
	}

	function split_lines( text: string, [ from, to ]: Range ) {

		const res = [] as Range[]
		let head = from

		for( let pos = from; pos <= to; ++ pos ) {
			if( pos < to && text[ pos ] !== '\n' ) continue
			if( pos > head ) res.push([ head, pos ])
			head = pos + 1
		}

		return res
	}

	function snap( text: string, pos: number, dir: -1 | 1 ) {
		const prev = text.charCodeAt( pos - 1 )
		const next = text.charCodeAt( pos )
		const torn = prev >= 0xD800 && prev <= 0xDBFF && next >= 0xDC00 && next <= 0xDFFF
		return torn ? pos + dir : pos
	}

	export function $bog_rich_url( raw: string ) {

		const uri = raw.trim()
		if( !uri || /[\p{C}\p{Z}]/u.test( uri ) ) return ''

		const scheme = /^([a-z][a-z0-9+.-]*):(?!\d+(?:[\/?#]|$))/i.exec( uri )?.[1].toLowerCase()

		if( scheme === 'mailto' ) return /^mailto:[^@\s]+@[^@\s]+$/i.test( uri ) ? uri : ''
		if( scheme && scheme !== 'http' && scheme !== 'https' ) return ''
		if( scheme && !/^https?:\/\//i.test( uri ) ) return ''
		if( !scheme && !/^[^\/?#@]+\.[\p{L}\d-]{2,}(?::\d+)?(?:[\/?#]|$)/u.test( uri ) ) return ''

		try {
			return new URL( scheme ? uri : 'https://' + uri ).href
		} catch {
			return ''
		}

	}

	function zone_valid( zone: string ) {
		try {
			new Intl.DateTimeFormat( 'en', { timeZone: zone } )
			return true
		} catch {
			return false
		}
	}

	function valid( raw: any, text: string ): $bog_rich_entity | null {

		if( !raw || typeof raw !== 'object' ) return null

		const { type, offset, length } = raw
		if( !Number.isSafeInteger( offset ) || !Number.isSafeInteger( length ) ) return null
		if( offset < 0 || length <= 0 || offset >= text.length ) return null

		const from = snap( text, offset, 1 )
		const to = snap( text, Math.min( text.length, offset + length ), -1 )
		if( from >= to ) return null

		const base = { offset: from, length: to - from }

		switch( type ) {

			case 'bold':
			case 'italic':
			case 'underline':
			case 'strikethrough':
			case 'spoiler':
			case 'code':
				return { ... base, type }

			case 'blockquote':
				return raw.collapsed === true ? { ... base, type, collapsed: true } : { ... base, type }

			case 'pre': {
				const language = typeof raw.language === 'string' ? raw.language.trim() : ''
				return /^[\w.+#-]{1,32}$/.test( language ) ? { ... base, type, language } : { ... base, type }
			}

			case 'text_link': {
				const url = typeof raw.url === 'string' ? $bog_rich_url( raw.url ) : ''
				return url ? { ... base, type, url } : null
			}

			case 'date_time': {
				if( !Number.isSafeInteger( raw.timestamp ) || Math.abs( raw.timestamp ) > 8.64e12 ) return null
				if( !$bog_rich_date_formats.includes( raw.format ) ) return null
				const mark = { ... base, type, timestamp: raw.timestamp as number, format: raw.format as $bog_rich_date_format }
				return typeof raw.timezone === 'string' && zone_valid( raw.timezone ) ? { ... mark, timezone: raw.timezone } : mark
			}

		}

		return null
	}

	/** Границы абзаца, в котором стоит позиция. */
	export function $bog_rich_line( text: string, pos: number ): Range {
		const next = text.indexOf( '\n', pos )
		return [ pos > 0 ? text.lastIndexOf( '\n', pos - 1 ) + 1 : 0, next < 0 ? text.length : next ]
	}

	/** Абзацы, которых касается диапазон. */
	export function $bog_rich_lines( text: string, from: number, to: number ) {

		const res = [] as Range[]
		let pos = from

		while( true ) {
			const line = $bog_rich_line( text, pos )
			if( res.length && line[0] === to && line[1] > to ) break
			res.push( line )
			if( line[1] >= to ) break
			pos = line[1] + 1
		}

		return res as readonly Range[]
	}

	function expand( text: string, from: number, to: number ): Range {
		const lines = $bog_rich_lines( text, from, to )
		return [ lines[0][0], lines.at( -1 )![1] ]
	}

	function overlaps( entity: $bog_rich_entity, from: number, to: number ) {
		return entity.offset < to && end( entity ) > from
	}

	/** Приводит содержимое к единственному правильному виду, отбрасывая негодные сущности. */
	export function $bog_rich_normalize( raw: $bog_rich_content | null | undefined ): $bog_rich_content {

		const text = typeof raw?.text === 'string' ? raw.text.replace( /\r\n?/g, '\n' ) : ''
		const list = ( Array.isArray( raw?.entities ) ? raw!.entities : [] )
			.map( entity => valid( entity, text ) )
			.filter( $mol_guard_defined )
			.sort( ( a, b )=> a.offset - b.offset )

		if( !list.length ) return { text, entities: [] }

		const of = ( type: $bog_rich_type )=> list.filter( entity => entity.type === type )
		const res = [] as $bog_rich_entity[]
		const solid = [] as Range[]

		const pres = [] as $bog_rich_entity[]
		for( const mark of of( 'pre' ) ) {
			const [ from, to ] = expand( text, mark.offset, end( mark ) )
			if( from >= to || pres.some( pre => overlaps( pre, from, to ) ) ) continue
			pres.push( place( mark, from, to ) )
			solid.push([ from, to ])
		}
		res.push( ... pres )

		for( const mark of of( 'date_time' ) ) {
			const from = mark.offset
			const to = end( mark )
			if( solid.some( hole => hole[0] < to && hole[1] > from ) ) continue
			if( text.slice( from, to ).includes( '\n' ) ) continue
			res.push( mark )
			solid.push([ from, to ])
		}

		const quotes = [] as $bog_rich_entity[]
		for( const mark of of( 'blockquote' ) ) {
			const [ from, to ] = expand( text, mark.offset, end( mark ) )
			if( from >= to || quotes.some( quote => overlaps( quote, from, to ) ) ) continue
			if( solid.some( hole => hole[0] < to && hole[1] > from ) ) continue
			quotes.push( place( mark, from, to ) )
		}
		res.push( ... quotes )

		const code = merge(
			of( 'code' ).flatMap( mark => subtract( [ mark.offset, end( mark ) ], solid ) ).flatMap( range => split_lines( text, range ) ),
			true,
		)
		for( const range of code ) res.push( place( { type: 'code' }, ... range ) )

		const holes = [ ... solid, ... code ]

		for( const range of merge( of( 'spoiler' ).flatMap( mark => subtract( [ mark.offset, end( mark ) ], holes ) ), false ) ) {
			res.push( place( { type: 'spoiler' }, ... range ) )
		}

		const taken = [] as Range[]
		for( const mark of of( 'text_link' ) ) {
			if( mark.type !== 'text_link' ) continue
			const parts = subtract( [ mark.offset, end( mark ) ], [ ... holes, ... taken ] ).flatMap( range => split_lines( text, range ) )
			for( const range of parts ) {
				res.push( place( { type: 'text_link', url: mark.url }, ... range ) )
				taken.push( range )
			}
		}

		for( const type of $bog_rich_styles ) {
			for( const range of merge( of( type ).flatMap( mark => subtract( [ mark.offset, end( mark ) ], holes ) ), true ) ) {
				res.push( place( { type }, ... range ) )
			}
		}

		res.sort( ( a, b )=> a.offset - b.offset || b.length - a.length || order.indexOf( a.type ) - order.indexOf( b.type ) )

		const entities = res.map( ({ type, offset, length, ... rest })=> ({ type, offset, length, ... rest }) as $bog_rich_entity )

		return { text, entities }
	}

	export function $bog_rich_equal( left: $bog_rich_content, right: $bog_rich_content ) {
		return left.text === right.text && $mol_compare_deep( left.entities, right.entities )
	}

	function block_is( mark: $bog_rich_mark ) {
		return mark.type === 'pre' || mark.type === 'blockquote'
	}

	/** Заменяет кусок текста, сдвигая сущности. Вставке достаются `marks`. */
	export function $bog_rich_replace(
		content: $bog_rich_content,
		from: number,
		to: number,
		insert: string,
		marks: readonly $bog_rich_mark[] = [],
	): $bog_rich_content {

		const text = content.text.slice( 0, from ) + insert + content.text.slice( to )
		const grow = insert.length - ( to - from )
		const edge = from + insert.length
		const line_head = from === 0 || content.text[ from - 1 ] === '\n'
		const res = [] as $bog_rich_entity[]

		for( const mark of content.entities ) {

			const head = mark.offset
			const tail = end( mark )

			if( mark.type === 'date_time' && head < to && tail > from ) continue

			if( block_is( mark ) ) {

				const until = tail < from ? tail : tail >= to ? tail + grow : edge
				let since = head <= from ? head : head > to ? head + grow : -1

				if( since < 0 && head === to && line_head && !insert ) since = from
				if( since < 0 ) since = $bog_rich_line( text, edge )[1] + 1

				if( since < until ) res.push( place( mark, since, until ) )
				continue
			}

			const since = head < from ? head : head >= to ? head + grow : edge
			const until = tail <= from ? tail : tail >= to ? tail + grow : from
			if( since < until ) res.push( place( mark, since, until ) )

		}

		if( insert ) for( const mark of marks ) res.push( place( mark, from, edge ) )

		return $bog_rich_normalize({ text, entities: res })
	}

	/** Вырезает кусок содержимого, смещая сущности к началу. */
	export function $bog_rich_slice( content: $bog_rich_content, from: number, to: number ): $bog_rich_content {

		const entities = content.entities.flatMap( mark => {
			const head = Math.max( mark.offset, from )
			const tail = Math.min( end( mark ), to )
			if( head >= tail ) return []
			if( mark.type === 'date_time' && tail - head < mark.length ) return []
			return [ place( mark, head - from, tail - from ) ]
		} )

		return $bog_rich_normalize({ text: content.text.slice( from, to ), entities })
	}

	/** Вставляет содержимое вместе с его стилями. */
	export function $bog_rich_insert( content: $bog_rich_content, from: number, to: number, part: $bog_rich_content ): $bog_rich_content {

		const base = $bog_rich_replace( content, from, to, part.text )
		const until = from + part.text.length
		const styles = base.entities.flatMap( mark => {
			if( block_is( mark ) || mark.offset >= from || end( mark ) <= until ) return [ mark ]
			return [ place( mark, mark.offset, from ), place( mark, until, end( mark ) ) ]
		} )

		const inner = part.entities.map( mark => place( mark, mark.offset + from, end( mark ) + from ) )
		const boxed = base.entities.filter( mark => block_is( mark ) && mark.offset <= from && end( mark ) >= until )

		const fit = inner.filter( mark => {
			if( boxed.length ) return !block_is( mark )
			if( mark.type !== 'blockquote' && mark.type !== 'pre' ) return true
			const [ head ] = $bog_rich_line( base.text, mark.offset )
			const [ , tail ] = $bog_rich_line( base.text, end( mark ) )
			return head >= from && tail <= until
		} )

		return $bog_rich_normalize({ text: base.text, entities: [ ... styles, ... fit ] })
	}

	/** Срезает пробелы по краям, сохраняя стили на местах. */
	export function $bog_rich_trim( content: $bog_rich_content ) {
		const from = content.text.length - content.text.trimStart().length
		const to = content.text.trimEnd().length
		return from < to ? $bog_rich_slice( content, from, to ) : $bog_rich_empty
	}

	/** Текст для превью и уведомлений: скрытое заменено подписью. */
	export function $bog_rich_preview( content: $bog_rich_content, mask = '▒▒▒▒' ) {

		let text = content.text
		for( const mark of [ ... content.entities ].reverse() ) {
			if( mark.type === 'spoiler' ) text = text.slice( 0, mark.offset ) + mask + text.slice( end( mark ) )
		}

		return text
	}

	export function $bog_rich_at( content: $bog_rich_content, type: $bog_rich_type, from: number, to = from ) {
		return content.entities.find( mark => mark.type === type && ( block_is( mark )
			? mark.offset <= from && end( mark ) >= to
			: mark.offset <= from && end( mark ) >= to && ( from < to || mark.offset < from && end( mark ) > from )
		) ) ?? null
	}

	function ranges_of( content: $bog_rich_content, ... types: readonly $bog_rich_type[] ) {
		return content.entities.filter( mark => types.includes( mark.type ) ).map( mark => [ mark.offset, end( mark ) ] as Range )
	}

	function quotable( content: $bog_rich_content, from: number, to: number ) {
		const solid = ranges_of( content, 'pre', 'date_time' )
		return $bog_rich_lines( content.text, from, to )
			.filter( ([ head, tail ])=> !solid.some( hole => hole[0] < tail && hole[1] > head || hole[0] <= head && hole[1] >= tail ) )
	}

	function room( content: $bog_rich_content, type: $bog_rich_type, from: number, to: number ) {
		const solid = ranges_of( content, 'pre', 'date_time' )
		const holes = type === 'code' ? solid : [ ... solid, ... ranges_of( content, 'code' ) ]
		return subtract( [ from, to ], holes ).flatMap( range => split_lines( content.text, range ) )
	}

	/** Состояние команды на диапазоне. */
	export function $bog_rich_state_of( content: $bog_rich_content, type: $bog_rich_type, from: number, to: number ): $bog_rich_state {

		const { text, entities } = content

		if( type === 'date_time' ) {
			if( entities.some( mark => mark.type === 'date_time' && mark.offset <= from && end( mark ) >= to && from < to ) ) return 'on'
			if( text.slice( from, to ).includes( '\n' ) ) return 'disabled'
			if( [ 'pre', 'blockquote' ].some( type => $bog_rich_at( content, type as $bog_rich_type, from, to ) ) ) return 'disabled'
			if( ranges_of( content, 'code' ).some( hole => from < to ? hole[0] < to && hole[1] > from : hole[0] < from && hole[1] > from ) ) return 'disabled'
			return 'off'
		}

		if( type === 'pre' || type === 'blockquote' ) {

			const lines = type === 'pre' ? $bog_rich_lines( text, from, to ) : quotable( content, from, to )
			if( !lines.length ) return 'disabled'

			const boxes = ranges_of( content, type )
			const inside = lines.filter( ([ head, tail ])=> boxes.some( box => box[0] <= head && box[1] >= tail ) )
			return inside.length === 0 ? 'off' : inside.length === lines.length ? 'on' : 'mixed'
		}

		if( from === to ) {
			if( $bog_rich_at( content, 'pre', from ) ) return 'disabled'
			if( type !== 'code' && $bog_rich_at( content, 'code', from ) ) return 'disabled'
			return $bog_rich_at( content, type, from ) ? 'on' : 'off'
		}

		if( type === 'code' && text.slice( from, to ).includes( '\n' ) ) return 'disabled'

		const parts = room( content, type, from, to )
		if( !parts.length ) return 'disabled'

		const own = ranges_of( content, type )
		const bare = parts.flatMap( part => subtract( part, own ) )
		const size = ( list: readonly Range[] )=> list.reduce( ( sum, [ head, tail ])=> sum + tail - head, 0 )
		const rest = size( bare )

		return rest === 0 ? 'on' : rest === size( parts ) ? 'off' : 'mixed'
	}

	function cut( entities: readonly $bog_rich_entity[], from: number, to: number, fits: ( mark: $bog_rich_entity )=> boolean ) {
		return entities.flatMap( mark => fits( mark )
			? subtract( [ mark.offset, end( mark ) ], [ [ from, to ] ] ).map( range => place( mark, ... range ) )
			: [ mark ]
		)
	}

	function unbox( entities: readonly $bog_rich_entity[], lines: readonly Range[], type: 'pre' | 'blockquote' ) {

		const from = lines[0][0]
		const to = lines.at( -1 )![1]

		return entities.flatMap( mark => {
			if( mark.type !== type || mark.offset > to || end( mark ) < from ) return [ mark ]
			const parts = [ [ mark.offset, from - 1 ], [ to + 1, end( mark ) ] ] as Range[]
			return parts.filter( ([ head, tail ])=> head < tail ).map( range => place( mark, ... range ) )
		} )
	}

	/** Снимает стиль с диапазона. */
	export function $bog_rich_remove( content: $bog_rich_content, type: $bog_rich_type, from: number, to: number ): $bog_rich_content {

		const entities = type === 'pre' || type === 'blockquote'
			? unbox( content.entities, $bog_rich_lines( content.text, from, to ), type )
			: type === 'date_time'
			? content.entities.filter( mark => mark.type !== type || !overlaps( mark, from, to ) )
			: cut( content.entities, from, to, mark => mark.type === type )

		return $bog_rich_normalize({ text: content.text, entities })
	}

	/** Применяет стиль ко всей допустимой части диапазона. */
	export function $bog_rich_apply( content: $bog_rich_content, mark: $bog_rich_mark, from: number, to: number ): $bog_rich_content {

		const { text } = content
		const done = ( entities: readonly $bog_rich_entity[] )=> $bog_rich_normalize({ text, entities })

		if( $bog_rich_state_of( content, mark.type, from, to ) === 'disabled' ) return content

		if( mark.type === 'pre' ) {

			const [ head, tail ] = expand( text, from, to )
			if( head === tail ) return content

			const clean = content.entities.filter( item => item.type !== 'date_time' || !overlaps( item, head, tail ) )
			const free = unbox( unbox( clean, $bog_rich_lines( text, from, to ), 'blockquote' ), $bog_rich_lines( text, from, to ), 'pre' )
			return done([ ... cut( free, head, tail, item => !block_is( item ) ), place( mark, head, tail ) ])
		}

		if( mark.type === 'blockquote' ) {

			const groups = [] as [ number, number ][]
			for( const [ head, tail ] of quotable( content, from, to ) ) {
				const last = groups.at( -1 )
				if( last && last[1] + 1 === head ) last[1] = tail
				else groups.push([ head, tail ])
			}

			let entities = content.entities
			for( const group of groups ) {
				for( const item of entities ) {
					if( item.type !== 'blockquote' || item.offset > group[1] || end( item ) < group[0] ) continue
					group[0] = Math.min( group[0], item.offset )
					group[1] = Math.max( group[1], end( item ) )
				}
				if( group[0] === group[1] ) continue
				entities = [ ... unbox( entities, [ group ], 'blockquote' ), place( mark, ... group ) ]
			}

			return done( entities )
		}

		if( from === to ) return content

		if( mark.type === 'date_time' ) {
			const free = content.entities.filter( item => item.type !== 'date_time' || !overlaps( item, from, to ) )
			return done([ ... cut( free, from, to, item => !block_is( item ) ), place( mark, from, to ) ])
		}

		const parts = room( content, mark.type, from, to )
		let entities = content.entities

		for( const part of parts ) {
			if( mark.type === 'code' ) entities = cut( entities, ... part, item => !block_is( item ) && item.type !== 'date_time' )
			if( mark.type === 'text_link' ) entities = cut( entities, ... part, item => item.type === 'text_link' )
		}

		const spans = mark.type === 'spoiler' && parts.length > 1 && !ranges_of( content, 'pre', 'date_time', 'code' ).some( hole => hole[0] < to && hole[1] > from )
			? [ [ parts[0][0], parts.at( -1 )![1] ] as Range ]
			: parts

		return done([ ... entities, ... spans.map( part => place( mark, ... part ) ) ])
	}

	/** Переключает стиль: сплошной снимает, остальное применяет. */
	export function $bog_rich_toggle( content: $bog_rich_content, mark: $bog_rich_mark, from: number, to: number ) {
		return $bog_rich_state_of( content, mark.type, from, to ) === 'on'
			? $bog_rich_remove( content, mark.type, from, to )
			: $bog_rich_apply( content, mark, from, to )
	}

	export function $bog_rich_clear_able( content: $bog_rich_content, from: number, to: number ) {
		return from < to && !$bog_rich_equal( content, $bog_rich_clear( content, from, to ) )
	}

	/** Снимает всё оформление с диапазона. */
	export function $bog_rich_clear( content: $bog_rich_content, from: number, to: number ): $bog_rich_content {

		if( from === to ) return content

		const lines = $bog_rich_lines( content.text, from, to )
		const boxed = unbox( unbox( content.entities, lines, 'blockquote' ), lines, 'pre' )
		const dated = boxed.filter( mark => mark.type !== 'date_time' || !overlaps( mark, from, to ) )

		return $bog_rich_normalize({ text: content.text, entities: cut( dated, from, to, mark => !block_is( mark ) ) })
	}

	/** Стили, которые достанутся набранному здесь тексту. */
	export function $bog_rich_typing( content: $bog_rich_content, from: number, to: number ): readonly $bog_rich_mark[] {

		const bare = ( mark: $bog_rich_entity )=> {
			const { offset, length, ... rest } = mark
			return rest as $bog_rich_mark
		}

		return content.entities.filter( mark => {
			if( block_is( mark ) || mark.type === 'date_time' ) return false
			if( from < to ) return mark.offset <= from && end( mark ) > from
			if( mark.offset >= from ) return false
			return ( $bog_rich_styles as readonly string[] ).includes( mark.type ) ? end( mark ) >= from : end( mark ) > from
		} ).map( bare )
	}

	/** Раздвигает диапазон так, чтобы дата не рвалась. */
	export function $bog_rich_whole( content: $bog_rich_content, from: number, to: number ): Range {

		for( const mark of content.entities ) {
			if( mark.type !== 'date_time' ) continue
			if( from < to ? !overlaps( mark, from, to ) : !( mark.offset < from && end( mark ) > from ) ) continue
			from = Math.min( from, mark.offset )
			to = Math.max( to, end( mark ) )
		}

		return [ from, to ]
	}

	/** Граница графемы слева или справа от позиции. */
	export function $bog_rich_grapheme( text: string, pos: number, dir: -1 | 1 ) {

		const [ head, tail ] = $bog_rich_line( text, pos )
		if( dir < 0 && pos === head ) return Math.max( 0, pos - 1 )
		if( dir > 0 && pos === tail ) return Math.min( text.length, pos + 1 )

		const line = text.slice( head, tail )
		const sizes = Intl.Segmenter
			? [ ... new Intl.Segmenter( undefined, { granularity: 'grapheme' } ).segment( line ) ].map( part => part.segment.length )
			: [ ... line ].map( char => char.length )

		let at = head
		for( const size of sizes ) {
			if( dir < 0 ? at + size >= pos : at + size > pos ) return dir < 0 ? at : at + size
			at += size
		}

		return pos
	}

	/** Обрезает текст по лимиту, не разрывая графему. */
	export function $bog_rich_fit( text: string, limit: number ) {

		if( text.length <= limit ) return text
		if( limit <= 0 ) return ''

		const prev = $bog_rich_grapheme( text, limit, -1 )
		return text.slice( 0, $bog_rich_grapheme( text, prev, 1 ) <= limit ? limit : prev )
	}

	/** Блоки содержимого по порядку. Абзацы вне цитат и кода слиты в один блок. */
	export function $bog_rich_blocks( content: $bog_rich_content ): readonly $bog_rich_block[] {

		const { text } = content
		const res = [] as $bog_rich_block[]
		let pos = 0

		for( const mark of content.entities ) {
			if( mark.type !== 'pre' && mark.type !== 'blockquote' ) continue
			if( mark.offset > pos ) res.push({ type: 'text', from: pos, to: mark.offset - 1, mark: null })
			res.push({ type: mark.type, from: mark.offset, to: end( mark ), mark })
			pos = end( mark ) + 1
		}

		if( pos <= text.length ) res.push({ type: 'text', from: pos, to: text.length, mark: null })

		return res
	}

	/** Дерево вложенных стилей внутри куска текста. */
	export function $bog_rich_tree( content: $bog_rich_content, from: number, to: number, level = 2 ): readonly $bog_rich_node[] {

		if( from >= to ) return []
		if( level >= order.length ) return [ content.text.slice( from, to ) ]

		const res = [] as $bog_rich_node[]
		let pos = from

		const plain = ( until: number )=> {
			for( const node of $bog_rich_tree( content, pos, until, level + 1 ) ) {
				if( typeof node === 'string' && typeof res.at( -1 ) === 'string' ) res.push( res.pop() as string + node )
				else res.push( node )
			}
		}

		for( const [ index, mark ] of content.entities.entries() ) {

			if( mark.type !== order[ level ] || !overlaps( mark, from, to ) ) continue

			const head = Math.max( mark.offset, from )
			const tail = Math.min( end( mark ), to )

			plain( head )
			res.push({ key: `${ mark.type }_${ head }_${ tail }`, from: head, to: tail, mark, index, kids: $bog_rich_tree( content, head, tail, level + 1 ) })
			pos = tail

		}

		plain( to )

		return res
	}

	/** Минимальная правка, превращающая старый текст в новый, с подсказкой о каретке. */
	export function $bog_rich_diff( prev: string, next: string, caret: number ) {

		const limit = Math.min( prev.length, next.length )

		let tail = 0
		const tail_max = Math.min( limit, Math.max( 0, next.length - caret ) )
		while( tail < tail_max && prev[ prev.length - 1 - tail ] === next[ next.length - 1 - tail ] ) ++ tail

		let head = 0
		while( head < limit - tail && prev[ head ] === next[ head ] ) ++ head

		while( tail < limit - head && prev[ prev.length - 1 - tail ] === next[ next.length - 1 - tail ] ) ++ tail

		const from = Math.min( snap( prev, head, -1 ), snap( next, head, -1 ) )
		const tail_safe = Math.min( prev.length - snap( prev, prev.length - tail, 1 ), next.length - snap( next, next.length - tail, 1 ) )

		return { from, to: prev.length - tail_safe, insert: next.slice( from, next.length - tail_safe ) }
	}

}
