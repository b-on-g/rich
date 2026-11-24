namespace $.$$ {

	function press( mods: Partial< KeyboardEvent > ) {
		return { code: 'KeyB', keyCode: 66, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, isComposing: false, defaultPrevented: false, ... mods } as KeyboardEvent
	}

	$mol_test({

		'На маке жирный только по Cmd, Ctrl+B остаётся системе'( $ ) {
			let count = 0
			const hotkey = $bog_rich_hotkey.make({ $, mac: ()=> true, action: ()=> ({ ctrl_B: ()=> ++ count }) as any })
			hotkey.keydown( press({ ctrlKey: true }) )
			$mol_assert_equal( count, 0 )
			hotkey.keydown( press({ metaKey: true }) )
			$mol_assert_equal( count, 1 )
		},

		'На остальных жирный по Ctrl, в том числе в русской раскладке, но не во время IME и не с Alt'( $ ) {
			let count = 0
			const hotkey = $bog_rich_hotkey.make({ $, mac: ()=> false, action: ()=> ({ ctrl_B: ()=> ++ count }) as any })
			hotkey.keydown( press({ ctrlKey: true, key: 'и' }) )
			hotkey.keydown( press({ ctrlKey: true, isComposing: true }) )
			hotkey.keydown( press({ ctrlKey: true, altKey: true }) )
			hotkey.keydown( press({ metaKey: true }) )
			$mol_assert_equal( count, 1 )
		},

	})

}
