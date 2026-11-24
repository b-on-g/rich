namespace $ {

	function rich( text: string, ... entities: $bog_rich_entity[] ) {
		return $bog_rich_normalize({ text, entities })
	}

	function seen( content: $bog_rich_content ) {
		return content.entities.map( mark => `${ mark.type }:${ mark.offset }-${ mark.offset + mark.length }` ).join( ' ' )
	}

	const compatible: Record< string, readonly string[] > = {
		bold: [ 'italic', 'underline', 'strikethrough', 'blockquote', 'spoiler', 'text_link' ],
		italic: [ 'bold', 'underline', 'strikethrough', 'blockquote', 'spoiler', 'text_link' ],
		underline: [ 'bold', 'italic', 'strikethrough', 'blockquote', 'spoiler', 'text_link' ],
		strikethrough: [ 'bold', 'italic', 'underline', 'blockquote', 'spoiler', 'text_link' ],
		blockquote: [ 'bold', 'italic', 'underline', 'strikethrough', 'code', 'spoiler', 'text_link' ],
		code: [ 'blockquote' ],
		pre: [],
		spoiler: [ 'bold', 'italic', 'underline', 'strikethrough', 'blockquote', 'text_link' ],
		text_link: [ 'bold', 'italic', 'underline', 'strikethrough', 'blockquote', 'spoiler' ],
		date_time: [],
	}

	const marks: Record< string, $bog_rich_mark > = {
		bold: { type: 'bold' },
		italic: { type: 'italic' },
		underline: { type: 'underline' },
		strikethrough: { type: 'strikethrough' },
		blockquote: { type: 'blockquote' },
		code: { type: 'code' },
		pre: { type: 'pre' },
		spoiler: { type: 'spoiler' },
		text_link: { type: 'text_link', url: 'https://ya.ru/' },
		date_time: { type: 'date_time', timestamp: 0, format: 'datetime' },
	}

	$mol_test({

		'Матрица совместимости: вместе живут только разрешённые пары'() {
			for( const one in marks ) for( const two in marks ) {
				if( one === two ) continue
				const both = rich( 'слово',
					{ ... marks[ one ], offset: 0, length: 5 },
					{ ... marks[ two ], offset: 0, length: 5 },
				).entities.length === 2
				$mol_assert_equal( [ one, two, both ], [ one, two, compatible[ one ].includes( two ) ] )
			}
		},

		'Каждый стиль применяется, даёт on и снимается без следа'() {
			for( const type in marks ) {
				const off = rich( 'раз два' )
				$mol_assert_equal( [ type, $bog_rich_state_of( off, marks[ type ].type, 0, 7 ) ], [ type, 'off' ] )
				const on = $bog_rich_toggle( off, marks[ type ], 0, 7 )
				$mol_assert_equal( [ type, $bog_rich_state_of( on, marks[ type ].type, 0, 7 ) ], [ type, 'on' ] )
				$mol_assert_equal( on.text, off.text )
				$mol_assert_equal( $bog_rich_toggle( on, marks[ type ], 0, 7 ), off )
			}
		},

		'Частичное снятие оставляет два куска, смешанное состояние заливается целиком'() {
			const all = rich( 'abcdef', { type: 'bold', offset: 0, length: 6 } )
			const part = $bog_rich_toggle( all, { type: 'bold' }, 2, 4 )
			$mol_assert_equal( seen( part ), 'bold:0-2 bold:4-6' )
			$mol_assert_equal( $bog_rich_state_of( part, 'bold', 0, 6 ), 'mixed' )
			$mol_assert_equal( $bog_rich_toggle( part, { type: 'bold' }, 0, 6 ), all )
		},

		'Стиль на выделении с датой и кодом ложится на допустимые части'() {
			const content = rich( 'ab cd ef gh', { ... marks.date_time, offset: 3, length: 2 }, { type: 'code', offset: 6, length: 2 } )
			$mol_assert_equal( seen( $bog_rich_toggle( content, { type: 'bold' }, 0, 11 ) ), 'bold:0-3 date_time:3-5 bold:5-6 code:6-8 bold:8-11' )
			$mol_assert_equal( $bog_rich_state_of( content, 'bold', 3, 5 ), 'disabled' )
		},

		'Моноширинный снимает начертания и ссылку, но не цитату, и не бывает многострочным'() {
			const content = rich( 'a b\nc', { type: 'blockquote', offset: 0, length: 5 }, { type: 'bold', offset: 0, length: 3 }, { ... marks.text_link, offset: 0, length: 3 } )
			$mol_assert_equal( seen( $bog_rich_toggle( content, { type: 'code' }, 2, 3 ) ), 'blockquote:0-5 text_link:0-2 bold:0-2 code:2-3' )
			$mol_assert_equal( $bog_rich_state_of( content, 'code', 0, 5 ), 'disabled' )
		},

		'Код занимает целые абзацы, снимает стили и превращает дату в текст'() {
			const content = rich( 'aa\nbb\ncc', { type: 'bold', offset: 0, length: 8 }, { ... marks.date_time, offset: 3, length: 2 } )
			$mol_assert_equal( seen( $bog_rich_toggle( content, { type: 'pre' }, 4, 4 ) ), 'bold:0-3 pre:3-5 bold:5-8' )
		},

		'Цитата обходит абзац с датой и сливается с соседней при повторе'() {
			const content = rich( 'aa\nbb\ncc\ndd', { ... marks.date_time, offset: 3, length: 2 } )
			const quoted = $bog_rich_toggle( content, { type: 'blockquote' }, 0, 8 )
			$mol_assert_equal( seen( quoted ), 'blockquote:0-2 date_time:3-5 blockquote:6-8' )
			$mol_assert_equal( seen( $bog_rich_apply( quoted, { type: 'blockquote' }, 7, 10 ) ), 'blockquote:0-2 date_time:3-5 blockquote:6-11' )
		},

		'Снятие цитаты со среднего абзаца делит её надвое'() {
			const content = rich( 'aa\nbb\ncc', { type: 'blockquote', offset: 0, length: 8 }, { type: 'bold', offset: 3, length: 2 } )
			$mol_assert_equal( seen( $bog_rich_toggle( content, { type: 'blockquote' }, 4, 4 ) ), 'blockquote:0-2 bold:3-5 blockquote:6-8' )
		},

		'Очистка убирает всё в выделении, а снаружи оставляет'() {
			const content = rich( 'abcdef', { type: 'bold', offset: 0, length: 6 }, { type: 'spoiler', offset: 2, length: 2 } )
			$mol_assert_equal( seen( $bog_rich_clear( content, 2, 4 ) ), 'bold:0-2 bold:4-6' )
			$mol_assert_equal( $bog_rich_clear_able( rich( 'abc' ), 0, 3 ), false )
			const dated = rich( 'ab cd', { ... marks.date_time, offset: 0, length: 5 } )
			$mol_assert_equal( seen( $bog_rich_clear( dated, 1, 2 ) ), '' )
		},

		'Набор внутри растит стиль, на краях не растит, удаление целиком стирает'() {
			const content = rich( 'abcd', { type: 'spoiler', offset: 1, length: 2 } )
			$mol_assert_equal( seen( $bog_rich_replace( content, 2, 2, 'xx' ) ), 'spoiler:1-5' )
			$mol_assert_equal( seen( $bog_rich_replace( content, 1, 1, 'x' ) ), 'spoiler:2-4' )
			$mol_assert_equal( seen( $bog_rich_replace( content, 3, 3, 'x' ) ), 'spoiler:1-3' )
			$mol_assert_equal( seen( $bog_rich_replace( content, 1, 3, '' ) ), '' )
			$mol_assert_equal( seen( $bog_rich_replace( content, 2, 4, '' ) ), 'spoiler:1-2' )
		},

		'На правом краю продолжается начертание, но не спойлер и не ссылка'() {
			const content = rich( 'ab', { type: 'bold', offset: 0, length: 2 }, { type: 'spoiler', offset: 0, length: 2 }, { ... marks.text_link, offset: 0, length: 2 } )
			$mol_assert_equal( $bog_rich_typing( content, 2, 2 ), [ { type: 'bold' } ] )
			$mol_assert_equal( $bog_rich_typing( content, 0, 0 ), [] )
			$mol_assert_equal( $bog_rich_typing( content, 1, 1 ).length, 3 )
		},

		'Абзацы цитаты растут с переносом, слияние с обычным абзацем отдаёт его стиль'() {
			const content = rich( 'aa\nbb\ncc', { type: 'blockquote', offset: 3, length: 2 } )
			$mol_assert_equal( seen( $bog_rich_replace( content, 5, 5, '\n' ) ), 'blockquote:3-6' )
			$mol_assert_equal( seen( $bog_rich_replace( content, 2, 3, '' ) ), '' )
			$mol_assert_equal( seen( $bog_rich_replace( content, 5, 6, '' ) ), 'blockquote:3-7' )
			$mol_assert_equal( seen( $bog_rich_replace( content, 0, 3, '' ) ), 'blockquote:0-2' )
		},

		'Пустая строка на конце цитаты остаётся в цитате'() {
			$mol_assert_equal( seen( rich( 'ab\n', { type: 'blockquote', offset: 0, length: 3 } ) ), 'blockquote:0-3' )
			$mol_assert_equal( seen( rich( 'ab\ncd', { type: 'blockquote', offset: 0, length: 3 } ) ), 'blockquote:0-2' )
		},

		'Ссылка: новая поверх старой её обрезает, перенос её делит'() {
			const content = rich( 'abcdef', { type: 'text_link', url: 'https://a.ru', offset: 0, length: 4 } )
			const next = $bog_rich_apply( content, { type: 'text_link', url: 'https://b.ru' }, 2, 6 )
			$mol_assert_equal( next.entities, [
				{ type: 'text_link', offset: 0, length: 2, url: 'https://a.ru/' },
				{ type: 'text_link', offset: 2, length: 4, url: 'https://b.ru/' },
			] )
			$mol_assert_equal( seen( rich( 'ab\ncd', { ... marks.text_link, offset: 0, length: 5 } ) ), 'text_link:0-2 text_link:3-5' )
		},

		'Опасные и кривые адреса не проходят'() {
			const bad = [ 'javascript:alert(1)', 'data:text/html,x', 'file:///etc', 'vbscript:x', 'java\nscript:x', 'https://', 'https:ya.ru', '//ya.ru', 'слово', '', 'http://a b' ]
			for( const uri of bad ) $mol_assert_equal( [ uri, $bog_rich_url( uri ) ], [ uri, '' ] )
			$mol_assert_equal( $bog_rich_url( 'ya.ru/a?b=1' ), 'https://ya.ru/a?b=1' )
			$mol_assert_equal( $bog_rich_url( 'ya.ru:8080/a' ), 'https://ya.ru:8080/a' )
			$mol_assert_equal( $bog_rich_url( 'mailto:a@b.ru' ), 'mailto:a@b.ru' )
		},

		'Негодные сущности отбрасываются, текст остаётся'() {
			const bad = [
				{ type: 'bold', offset: -1, length: 2 },
				{ type: 'bold', offset: 0, length: 0 },
				{ type: 'bold', offset: 9, length: 1 },
				{ type: 'script', offset: 0, length: 1 },
				{ type: 'text_link', url: 'javascript:x', offset: 0, length: 1 },
				{ type: 'date_time', timestamp: 1.5, format: 'datetime', offset: 0, length: 1 },
				{ type: 'date_time', timestamp: 1, format: '<b>', offset: 0, length: 1 },
				null,
			] as any
			$mol_assert_equal( $bog_rich_normalize({ text: 'abc', entities: bad }), { text: 'abc', entities: [] } )
			$mol_assert_equal( $bog_rich_normalize( null ), $bog_rich_empty )
		},

		'Эмодзи не рвутся: ни границей стиля, ни удалением, ни лимитом'() {
			$mol_assert_equal( seen( rich( 'a😀b', { type: 'bold', offset: 0, length: 2 } ) ), 'bold:0-1' )
			for( const sign of [ '😀', '👨‍👩‍👧‍👦', '🇷🇺', 'й', '👍🏽' ] ) {
				const text = 'a' + sign + 'b'
				$mol_assert_equal( $bog_rich_grapheme( text, 1 + sign.length, -1 ), 1 )
				$mol_assert_equal( $bog_rich_grapheme( text, 1, 1 ), 1 + sign.length )
				$mol_assert_equal( $bog_rich_fit( text, sign.length ), 'a' )
				$mol_assert_equal( $bog_rich_fit( text, 1 + sign.length ), 'a' + sign )
			}
		},

		'Дата удаляется целиком и не растягивается набором рядом'() {
			const content = rich( '😀 завтра', { ... marks.date_time, offset: 3, length: 6 } )
			$mol_assert_equal( seen( $bog_rich_replace( content, 9, 9, '!' ) ), 'date_time:3-9' )
			$mol_assert_equal( seen( $bog_rich_replace( content, 0, 2, '' ) ), 'date_time:1-7' )
			$mol_assert_equal( $bog_rich_whole( content, 8, 9 ), [ 3, 9 ] )
			$mol_assert_equal( seen( $bog_rich_replace( content, 4, 5, '' ) ), '' )
		},

		'Обрезка краёв и кусок текста сдвигают стили'() {
			const content = rich( '  ab cd \n', { type: 'bold', offset: 5, length: 2 } )
			$mol_assert_equal( $bog_rich_trim( content ), rich( 'ab cd', { type: 'bold', offset: 3, length: 2 } ) )
			$mol_assert_equal( $bog_rich_trim( rich( ' \n ' ) ), $bog_rich_empty )
		},

		'Превью прячет скрытое'() {
			const content = rich( 'кот съел рыбу, рыбу', { type: 'spoiler', offset: 9, length: 4 }, { type: 'spoiler', offset: 15, length: 4 } )
			$mol_assert_equal( $bog_rich_preview( content, '…' ), 'кот съел …, …' )
		},

		'Вставка с чужими стилями не наследует стиль места'() {
			const content = rich( 'abcd', { type: 'bold', offset: 0, length: 4 } )
			const part = rich( 'XY', { type: 'italic', offset: 0, length: 1 } )
			$mol_assert_equal( seen( $bog_rich_insert( content, 2, 2, part ) ), 'bold:0-2 italic:2-3 bold:4-6' )
		},

		'Разность текстов находит правку у каретки и не рвёт суррогаты'() {
			$mol_assert_equal( $bog_rich_diff( 'aaa', 'aaaa', 2 ), { from: 1, to: 1, insert: 'a' } )
			$mol_assert_equal( $bog_rich_diff( 'привет', 'привёт', 6 ), { from: 4, to: 5, insert: 'ё' } )
			$mol_assert_equal( $bog_rich_diff( '😀', '😁', 2 ), { from: 0, to: 2, insert: '😁' } )
			$mol_assert_equal( $bog_rich_diff( 'abc', 'ac', 1 ), { from: 1, to: 2, insert: '' } )
		},

		'Дерево стилей повторяет текст, пересечения делятся на сегменты'() {
			const content = rich( 'abcdef', { type: 'bold', offset: 0, length: 4 }, { type: 'italic', offset: 2, length: 4 } )
			const flat = ( nodes: readonly $bog_rich_node[] ): string => nodes.map( node => typeof node === 'string' ? node : `<${ node.mark.type }>${ flat( node.kids ) }</>` ).join( '' )
			$mol_assert_equal( flat( $bog_rich_tree( content, 0, 6 ) ), '<bold>ab<italic>cd</></><italic>ef</>' )
		},

		'Блоки покрывают все абзацы, включая пустые'() {
			const content = rich( '\nab\n\ncd', { type: 'blockquote', offset: 1, length: 2 } )
			$mol_assert_equal( $bog_rich_blocks( content ).map( block => [ block.type, block.from, block.to ] ), [
				[ 'text', 0, 0 ],
				[ 'blockquote', 1, 3 ],
				[ 'text', 4, 7 ],
			] )
		},

		'Нормализация повторно ничего не меняет и переживает сериализацию'() {
			const content = rich( 'ab\ncd\nef', { type: 'spoiler', offset: 1, length: 6 }, { type: 'bold', offset: 0, length: 4 }, { type: 'blockquote', offset: 3, length: 1, collapsed: true }, { type: 'code', offset: 6, length: 1 } )
			$mol_assert_equal( $bog_rich_normalize( JSON.parse( JSON.stringify( content ) ) ), content )
		},

	})

}
