namespace $ {

	$mol_test({

		'Частые правки отменяются разом, отмена возвращается, новая правка стирает возврат'( $ ) {

			let value = 0
			const story = new $bog_rich_story< number >( next => { value = next } )
			story.$ = $

			const set = ( next: number )=> {
				story.stage( value, next )
				value = next
			}

			set( 1 )
			$.$mol_after_mock_warp()
			set( 2 )
			set( 3 )

			story.backward()
			$mol_assert_equal( value, 1 )
			story.forward()
			$mol_assert_equal( value, 3 )
			story.backward()
			set( 5 )
			story.forward()
			$mol_assert_equal( value, 5 )
			story.backward()
			story.backward()
			$mol_assert_equal( value, 0 )

		},

	})

}
