namespace $ {

	const parts = ( year: number, month: number, day: number, hour: number, minute = 0 )=> ({ year, month, day, hour, minute, second: 0 })

	$mol_test({

		'19:00 в Москве в декабре это 17:00 в Берлине'() {
			const [ moment ] = $bog_rich_zone_moments( parts( 2026, 12, 3, 19 ), 'Europe/Moscow' )
			$mol_assert_equal( $bog_rich_zone_parts( moment, 'Europe/Berlin' ), parts( 2026, 12, 3, 17 ) )
			$mol_assert_equal( $bog_rich_zone_text( moment, 'time_short', 'ru', 0, 'Europe/Berlin' ), '17:00' )
			$mol_assert_equal( $bog_rich_zone_text( moment, 'weekday', 'ru', 0, 'Europe/Moscow' ), 'Четверг' )
			$mol_assert_equal( $bog_rich_zone_text( moment, 'date_short', 'ru', 0, 'Europe/Moscow' ), '3 декабря' )
		},

		'При переводе часов время бывает несуществующим и двойным'() {
			$mol_assert_equal( $bog_rich_zone_moments( parts( 2026, 3, 29, 2, 30 ), 'Europe/Berlin' ), [] )
			const twice = $bog_rich_zone_moments( parts( 2026, 10, 25, 2, 30 ), 'Europe/Berlin' )
			$mol_assert_equal( twice.length, 2 )
			$mol_assert_equal( twice[1] - twice[0], 3600 )
		},

		'Относительное время до и после события'() {
			const day = 86400
			$mol_assert_equal( $bog_rich_zone_text( 9 * day, 'relative', 'ru', 0 ), 'через 9 дней' )
			$mol_assert_equal( $bog_rich_zone_text( 0, 'relative', 'ru', 9 * day ), '9 дней назад' )
			$mol_assert_equal( $bog_rich_zone_text( 60, 'relative', 'ru', 0 ), 'через 1 минуту' )
		},

		'Событие календаря пишет UTC и экранирует название'() {
			const ics = $bog_rich_zone_ics( Date.UTC( 2026, 11, 3, 16 ) / 1000, 'Встреча; важная\nочень', 0 )
			$mol_assert_equal( ics.includes( 'DTSTART:20261203T160000Z\r\n' ), true )
			$mol_assert_equal( ics.includes( 'SUMMARY:Встреча\\; важная\\nочень\r\n' ), true )
		},

	})

}
