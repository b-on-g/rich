namespace $ {

	function area( $: $, content: $bog_rich_content ) {
		const root = $.$mol_dom_context.document.createElement( 'div' )
		$bog_rich_dom_draw( root, content )
		return root
	}

	const content = $bog_rich_normalize({
		text: '\nжирный и обычный\n\nцитата\n\n  код\n\tещё\nдата',
		entities: [
			{ type: 'bold', offset: 1, length: 6 },
			{ type: 'blockquote', offset: 19, length: 6 },
			{ type: 'pre', offset: 27, length: 10 },
			{ type: 'date_time', timestamp: 0, format: 'text', offset: 38, length: 4 },
		],
	})

	$mol_test({

		'Текст читается из области точно таким, каким нарисован'( $ ) {
			$mol_assert_equal( $bog_rich_dom_read( area( $, content ) ).text, content.text )
			$mol_assert_equal( $bog_rich_dom_read( area( $, $bog_rich_empty ) ).text, '' )
		},

		'Каждая позиция текста переживает путь в документ и обратно'( $ ) {
			const root = area( $, content )
			const map = $bog_rich_dom_read( root )
			for( let pos = 0; pos <= content.text.length; ++ pos ) {
				if( pos > 38 && pos < 42 ) continue
				const [ node, at ] = $bog_rich_dom_point( map, root, pos )
				$mol_assert_equal( [ pos, $bog_rich_dom_offset( map, root, node, at ) ], [ pos, pos ] )
			}
		},

		'Перерисовка трогает только изменившиеся абзацы'( $ ) {
			const root = area( $, content )
			const before = [ ... root.childNodes ]
			$mol_assert_equal( $bog_rich_dom_draw( root, content ), false )
			$bog_rich_dom_draw( root, $bog_rich_replace( content, 2, 2, 'х' ) )
			const after = [ ... root.childNodes ]
			$mol_assert_equal( before.map( ( node, index )=> node === after[ index ] ), before.map( ( _, index )=> index !== 1 ) )
		},

		'Мусор браузера читается как текст: голые узлы, переносы и вложенные блоки'( $ ) {
			const root = $.$mol_dom_context.document.createElement( 'div' )
			root.innerHTML = 'раз<br><div>два<br></div><blockquote>три<br>четыре</blockquote>'
			$mol_assert_equal( $bog_rich_dom_read( root ).text, 'раз\nдва\nтри\nчетыре' )
		},

	})

}
