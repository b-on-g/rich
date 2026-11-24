namespace $ {

	export type $bog_rich_zone_parts = { year: number, month: number, day: number, hour: number, minute: number, second: number }

	/** Часы на стене в поясе для момента в секундах. */
	export function $bog_rich_zone_parts( timestamp: number, zone: string ): $bog_rich_zone_parts {

		const format = new Intl.DateTimeFormat( 'en-US', {
			timeZone: zone, hourCycle: 'h23', calendar: 'gregory', numberingSystem: 'latn',
			year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric',
		} )

		const res = {} as Record< string, number >
		for( const part of format.formatToParts( timestamp * 1000 ) ) res[ part.type ] = Number( part.value )

		return { year: res.year, month: res.month, day: res.day, hour: res.hour % 24, minute: res.minute, second: res.second }
	}

	function utc( parts: $bog_rich_zone_parts ) {
		return Date.UTC( parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second ) / 1000
	}

	/** Моменты, которым в поясе соответствуют эти часы: ни одного, один или два. */
	export function $bog_rich_zone_moments( parts: $bog_rich_zone_parts, zone: string ): readonly number[] {

		const guess = utc( parts )
		if( Number.isNaN( guess ) ) return []

		const found = [ guess - 86400, guess, guess + 86400 ]
			.map( moment => guess - ( utc( $bog_rich_zone_parts( moment, zone ) ) - moment ) )
			.filter( moment => utc( $bog_rich_zone_parts( moment, zone ) ) === guess )

		return [ ... new Set( found ) ].sort( ( a, b )=> a - b )
	}

	export function $bog_rich_zone_own() {
		return new Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
	}

	export function $bog_rich_zone_list(): readonly string[] {
		const all = ( Intl as any ).supportedValuesOf?.( 'timeZone' ) as readonly string[] | undefined
		return [ ... new Set([ $bog_rich_zone_own(), 'UTC', ... all ?? [] ]) ]
	}

	const shapes: Record< string, Intl.DateTimeFormatOptions > = {
		date_short: { day: 'numeric', month: 'long' },
		date_full: { day: 'numeric', month: 'long', year: 'numeric' },
		time_short: { hour: 'numeric', minute: '2-digit' },
		time_full: { hour: 'numeric', minute: '2-digit', second: '2-digit' },
		weekday: { weekday: 'long' },
		datetime: { day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' },
		moment: { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' },
	}

	function shape( timestamp: number, kind: string, lang: string, zone?: string ) {
		return new Intl.DateTimeFormat( lang, { ... shapes[ kind ], timeZone: zone } ).format( timestamp * 1000 )
	}

	const units = [ [ 'year', 31536000 ], [ 'month', 2592000 ], [ 'day', 86400 ], [ 'hour', 3600 ], [ 'minute', 60 ], [ 'second', 1 ] ] as const

	/** Текст даты в выбранном формате, без пояса считается по поясу зрителя. */
	export function $bog_rich_zone_text( timestamp: number, format: $bog_rich_date_format, lang: string, now: number, zone?: string ) {

		if( format !== 'relative' ) {
			const text = shape( timestamp, format === 'text' ? 'datetime' : format, lang, zone )
			return format === 'weekday' ? text.slice( 0, 1 ).toLocaleUpperCase( lang ) + text.slice( 1 ) : text
		}

		const diff = timestamp - now
		const [ unit, size ] = units.find( ([ , size ])=> Math.abs( diff ) >= size ) ?? units[5]

		return new Intl.RelativeTimeFormat( lang, { numeric: 'always' } ).format( Math.trunc( diff / size ), unit )
	}

	/** Полный момент со днём недели и поясом. */
	export function $bog_rich_zone_full( timestamp: number, lang: string, zone?: string ) {
		return shape( timestamp, 'moment', lang, zone )
	}

	/** Как часто относительной дате нужно обновляться, миллисекунды. */
	export function $bog_rich_zone_tick( diff: number ) {
		const size = Math.abs( diff )
		return size < 120 ? 1000 : size < 7200 ? 30000 : 600000
	}

	/** Событие календаря с временем в UTC. */
	export function $bog_rich_zone_ics( timestamp: number, title: string, now: number ) {

		const stamp = ( moment: number )=> new Date( moment * 1000 ).toISOString().replace( /[-:]|\.\d+/g, '' )
		const safe = title.replace( /[\\;,]/g, '\\$&' ).replace( /\r?\n/g, '\\n' )

		return [
			'BEGIN:VCALENDAR',
			'VERSION:2.0',
			'PRODID:-//bog//rich//EN',
			'BEGIN:VEVENT',
			`UID:${ timestamp }-${ now }@rich`,
			`DTSTAMP:${ stamp( now ) }`,
			`DTSTART:${ stamp( timestamp ) }`,
			`SUMMARY:${ safe }`,
			'END:VEVENT',
			'END:VCALENDAR',
			'',
		].join( '\r\n' )
	}

}
