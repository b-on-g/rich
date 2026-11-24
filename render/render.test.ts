namespace $.$$ {

	function render( $: $, text: string, ... entities: $bog_rich_entity[] ) {
		const context = $.$mol_ambient({
			$mol_state_arg: class extends $.$mol_state_arg {
				static override href() { return 'https://example.org/' }
			} as typeof $mol_state_arg,
		})
		return $bog_rich_render.make({ $: context, content: ()=> ({ text, entities }) })
	}

	function tree( view: $mol_view ) {
		return view.dom_tree() as HTMLElement
	}

	$mol_test({

		'Без стилей Markdown и HTML остаются текстом'( $ ) {
			const text = '**не жирный** `код` <b>тег</b> [подпись](адрес)'
			const node = tree( render( $, text ) )
			$mol_assert_equal( node.textContent, text )
			$mol_assert_equal( node.querySelectorAll( 'strong,code,b,a' ).length, 0 )
		},

		'Голый адрес становится ссылкой без точки на хвосте, в коде не становится'( $ ) {
			const node = tree( render( $, 'смотри https://ya.ru/a?b=1. и https://ya.ru/код', { type: 'code', offset: 29, length: 18 } ) )
			$mol_assert_equal( [ ... node.querySelectorAll( 'a' ) ].map( link => link.getAttribute( 'href' ) ), [ 'https://ya.ru/a?b=1' ] )
			$mol_assert_equal( $bog_rich_render_links( '(https://a.ru/x_(y))' ), [ { from: 1, to: 19 } ] )
		},

		'Стили вкладываются семантическими тегами, ссылка открывается безопасно'( $ ) {
			const node = tree( render( $, 'ab cd', { type: 'bold', offset: 0, length: 5 }, { type: 'italic', offset: 0, length: 2 }, { type: 'text_link', url: 'https://ya.ru/', offset: 3, length: 2 } ) )
			$mol_assert_equal( node.querySelector( 'strong em' )!.textContent, 'ab' )
			const link = node.querySelector( 'a' )!
			$mol_assert_equal( [ link.textContent, link.getAttribute( 'rel' ), link.getAttribute( 'target' ), link.title ], [ 'cd', 'noopener noreferrer', '_blank', 'https://ya.ru/' ] )
		},

		'Спойлер прячет текст из документа и из копирования, первый тап только раскрывает'( $ ) {

			const view = render( $, 'кот съел рыбу и хлеб',
				{ type: 'spoiler', offset: 9, length: 4 },
				{ type: 'text_link', url: 'https://ya.ru/', offset: 9, length: 4 },
				{ type: 'spoiler', offset: 16, length: 4 },
			)

			$mol_assert_equal( tree( view ).textContent!.includes( 'рыбу' ), false )
			$mol_assert_equal( tree( view ).querySelectorAll( 'a' ).length, 0 )
			$mol_assert_equal( view.shown_text(), 'кот съел ▒▒▒▒ и ▒▒▒▒' )

			const [ , first, , second ] = view.Text( 'text_0_20' ).sub() as any[]
			first.reveal()

			$mol_assert_equal( [ first.shown(), second.shown() ], [ true, false ] )
			$mol_assert_equal( tree( view ).querySelector( 'a' )!.textContent, 'рыбу' )
			$mol_assert_equal( view.shown_text(), 'кот съел рыбу и ▒▒▒▒' )

		},

		'Блок кода сохраняет отступы и пустые строки, адреса в нём не ссылки'( $ ) {
			const text = 'if( a ) {\n\tgo( "https://ya.ru" )\n\n}'
			const view = render( $, text, { type: 'pre', language: 'js', offset: 0, length: text.length } )
			const [ code ] = view.blocks() as readonly $bog_rich_code[]
			$mol_assert_equal( code.Rows().rows().map( row => ( row.dom_tree() as Element ).textContent!.trimEnd() ), [ 'if( a ) {', '\tgo( "https://ya.ru" )', '', '}' ] )
			$mol_assert_equal( code.text_export(), text )
			$mol_assert_equal( tree( view ).querySelectorAll( 'a' ).length, 0 )
		},

		'Дата показывает подпись, а рядом с эмодзи не съезжает'( $ ) {
			const view = render( $, '😀 старт!', { type: 'date_time', timestamp: 0, format: 'text', offset: 3, length: 5 } )
			$mol_assert_equal( tree( view ).textContent!.startsWith( '😀 старт!' ), true )
		},

		'Порядок блоков и пустых строк сохраняется'( $ ) {
			const view = render( $, 'a\n\nb\nc', { type: 'blockquote', offset: 3, length: 1 } )
			$mol_assert_equal( view.blocks().map( block => ( block.dom_tree() as Element ).nodeName.toLowerCase() ).includes( 'blockquote' ), true )
			$mol_assert_equal( view.blocks().length, 3 )
		},

	})

}
