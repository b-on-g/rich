namespace $.$$ {

	function stand( $: $, text = '', ... entities: $bog_rich_entity[] ) {
		const edit = $bog_rich_edit.make({ $ })
		edit.content( $bog_rich_normalize({ text, entities }) )
		edit.dom_tree()
		const select = ( anchor: number, focus = anchor )=> { edit.selection({ anchor, focus }) }
		return { edit, select, root: edit.Content().dom_node() as HTMLElement }
	}

	function seen( edit: $bog_rich_edit ) {
		const { text, entities } = edit.model()
		return entities.map( mark => `${ mark.type }:${ text.slice( mark.offset, mark.offset + mark.length ) }` ).join( ' ' )
	}

	function transfer( data: Record< string, string >, files: readonly File[] = [] ) {
		return { getData: ( type: string )=> data[ type ] ?? '', setData: ( type: string, text: string )=> { data[ type ] = text }, files }
	}

	function event( mods: {} ) {
		const self = {
			defaultPrevented: false,
			preventDefault() { self.defaultPrevented = true },
			stopPropagation() {},
			... mods,
		}
		return self as any
	}

	function key( code: string, mods = {} ) {
		return event({ code, keyCode: 0, key: '', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, isComposing: false, ... mods })
	}

	function input( inputType: string, data: string | null = null ) {
		return event({ inputType, data, cancelable: true, isComposing: false })
	}

	$mol_test({

		'Каждая команда применяется к выделению, снимается повтором и отменяется'( $ ) {
			for( const type of [ ... $bog_rich_toggles, 'blockquote', 'pre' ] as const ) {
				const { edit, select } = stand( $, 'раз два' )
				select( 7, 0 )
				edit.format_apply( type as any )
				$mol_assert_equal( seen( edit ), `${ type }:раз два` )
				$mol_assert_equal( edit.selection(), { anchor: 7, focus: 0 } )
				edit.format_apply( type as any )
				$mol_assert_equal( seen( edit ), '' )
				edit.undo()
				$mol_assert_equal( seen( edit ), `${ type }:раз два` )
				edit.undo()
				$mol_assert_equal( seen( edit ), '' )
				edit.redo()
				$mol_assert_equal( seen( edit ), `${ type }:раз два` )
			}
		},

		'Без выделения стиль достаётся следующему набору и отключается повтором'( $ ) {
			const { edit, select } = stand( $, 'a' )
			select( 1 )
			edit.format_apply( 'spoiler' )
			$mol_assert_equal( edit.format_state( 'spoiler' ), 'on' )
			edit.write( 1, 1, 'b' )
			edit.write( 2, 2, 'c' )
			edit.format_apply( 'spoiler' )
			edit.write( 3, 3, 'd' )
			$mol_assert_equal( [ edit.model().text, seen( edit ) ], [ 'abcd', 'spoiler:bc' ] )
		},

		'Жирный внутри жирного можно выключить для набора'( $ ) {
			const { edit, select } = stand( $, 'ab', { type: 'bold', offset: 0, length: 2 } )
			select( 1 )
			edit.format_apply( 'bold' )
			edit.write( 1, 1, 'x' )
			$mol_assert_equal( seen( edit ), 'bold:a bold:b' )
		},

		'Набор браузера подхватывается из документа и получает стиль места'( $ ) {
			const { edit, root } = stand( $, 'жир', { type: 'bold', offset: 0, length: 3 } )
			root.querySelector( 'strong' )!.firstChild!.nodeValue = 'жирно'
			edit.typed( event({}) )
			$mol_assert_equal( [ edit.model().text, seen( edit ) ], [ 'жирно', 'bold:жирно' ] )
		},

		'Во время IME документ не перестраивается, после согласуется'( $ ) {
			const { edit, root, select } = stand( $, 'a' )
			select( 1 )
			edit.format_apply( 'bold' )
			edit.compose_start()
			const text = root.querySelector( 'div' )!.firstChild!
			text.nodeValue = 'aに'
			edit.typed( event({ isComposing: true }) )
			$mol_assert_equal( root.querySelector( 'div' )!.firstChild, text )
			$mol_assert_equal( [ edit.model().text, seen( edit ) ], [ 'aに', 'bold:に' ] )
			edit.compose_end()
			$mol_assert_equal( root.querySelector( 'strong' )!.textContent, 'に' )
		},

		'Очистка снаружи во время IME не теряется'( $ ) {
			const { edit, root } = stand( $, 'a' )
			edit.compose_start()
			edit.content( $bog_rich_empty )
			edit.dom_tree()
			$mol_assert_equal( [ root.textContent, edit.composing ], [ '', false ] )
		},

		'Внешняя замена стирает историю и выделение прошлого содержимого'( $ ) {
			const { edit, select } = stand( $, 'первый' )
			select( 0, 6 )
			edit.format_apply( 'bold' )
			edit.content({ text: 'второй', entities: [] })
			edit.dom_tree()
			edit.undo()
			$mol_assert_equal( edit.model(), { text: 'второй', entities: [] } )
			$mol_assert_equal( edit.selection(), { anchor: 6, focus: 6 } )
		},

		'Enter продолжает цитату, на пустой последней строке выходит из неё'( $ ) {
			const { edit, select } = stand( $, 'ab', { type: 'blockquote', offset: 0, length: 2 } )
			select( 2 )
			edit.before( input( 'insertParagraph' ) )
			$mol_assert_equal( edit.model().entities[0].length, 3 )
			edit.before( input( 'insertParagraph' ) )
			$mol_assert_equal( edit.model(), { text: 'ab\n', entities: [ { type: 'blockquote', offset: 0, length: 2 } ] } )
			edit.write( 3, 3, 'c' )
			$mol_assert_equal( seen( edit ), 'blockquote:ab' )
		},

		'Из кода выходят командой и стрелкой вниз, Enter и Tab в нём пишут текст'( $ ) {
			const { edit, select } = stand( $, 'ab', { type: 'pre', offset: 0, length: 2 } )
			let sent = 0
			edit.submit_with_enter = ()=> true
			edit.submit = ()=> ++ sent
			select( 2 )

			const enter = key( 'Enter' )
			edit.Hotkey().keydown( enter )
			$mol_assert_equal( [ sent, enter.defaultPrevented ], [ 0, false ] )

			edit.before( input( 'insertParagraph' ) )
			edit.Hotkey().keydown( key( 'Tab' ) )
			$mol_assert_equal( edit.model().text, 'ab\n\t' )

			edit.Hotkey().keydown( key( 'ArrowDown' ) )
			edit.write( edit.selection().focus, edit.selection().focus, 'c' )
			$mol_assert_equal( [ edit.model().text, seen( edit ) ], [ 'ab\n\t\nc', 'pre:ab\n\t' ] )
		},

		'Цитата на пустой строке ждёт набора'( $ ) {
			const { edit, select } = stand( $, '' )
			select( 0 )
			edit.format_apply( 'blockquote' )
			$mol_assert_equal( edit.format_state( 'blockquote' ), 'on' )
			edit.write( 0, 0, 'a' )
			edit.write( 1, 1, 'b' )
			$mol_assert_equal( seen( edit ), 'blockquote:ab' )
		},

		'Enter отправляет только когда просили, Shift+Enter нет'( $ ) {
			const { edit } = stand( $, 'a' )
			let sent = 0
			edit.submit = ()=> ++ sent
			edit.Hotkey().keydown( key( 'Enter' ) )
			edit.submit_with_enter = ()=> true
			edit.Hotkey().keydown( key( 'Enter', { shiftKey: true } ) )
			edit.Hotkey().keydown( key( 'Enter', { isComposing: true } ) )
			$mol_assert_equal( sent, 0 )
			edit.Hotkey().keydown( key( 'Enter' ) )
			$mol_assert_equal( sent, 1 )
		},

		'Хоткей без допустимого действия не перехватывается'( $ ) {
			const { edit, select } = stand( $, 'ab', { type: 'pre', offset: 0, length: 2 } )
			edit.Hotkey().mac = ()=> false
			select( 0, 2 )
			const bold = key( 'KeyB', { ctrlKey: true } )
			edit.Hotkey().keydown( bold )
			$mol_assert_equal( [ bold.defaultPrevented, seen( edit ) ], [ false, 'pre:ab' ] )
		},

		'Ссылка: новая по выделению, правка целиком, удаление, опасный адрес не применяется'( $ ) {
			const { edit, select } = stand( $, 'мой сайт' )
			select( 4, 8 )
			edit.link_open()
			$mol_assert_equal( edit.link_text(), 'сайт' )
			edit.link_url( 'javascript:alert(1)' )
			$mol_assert_equal( edit.link_ready(), false )
			edit.link_apply()
			$mol_assert_equal( seen( edit ), '' )
			edit.link_url( 'ya.ru' )
			edit.link_apply()
			$mol_assert_equal( edit.model().entities, [ { type: 'text_link', offset: 4, length: 4, url: 'https://ya.ru/' } ] )

			select( 6 )
			edit.link_open()
			$mol_assert_equal( [ edit.link_text(), edit.link_url() ], [ 'сайт', 'https://ya.ru/' ] )
			edit.link_text( 'дом' )
			edit.link_apply()
			$mol_assert_equal( [ edit.model().text, seen( edit ) ], [ 'мой дом', 'text_link:дом' ] )

			select( 5 )
			edit.link_open()
			edit.link_remove()
			$mol_assert_equal( seen( edit ), '' )
		},

		'Форма не применяется к подменённому содержимому'( $ ) {
			const { edit, select } = stand( $, 'один' )
			select( 0, 4 )
			edit.link_open()
			edit.link_url( 'ya.ru' )
			edit.content({ text: 'другой', entities: [] })
			edit.dom_tree()
			edit.link_apply()
			$mol_assert_equal( edit.model(), { text: 'другой', entities: [] } )
		},

		'Дата вставляется атомом, удаляется целиком и правится с прежними значениями'( $ ) {
			const { edit, select } = stand( $, '😀 ' )
			select( 3 )
			edit.date_open()
			edit.date_zone( 'Europe/Moscow' )
			edit.date_moment( '2026-12-03 19:00' )
			edit.date_format( 'text' )
			edit.date_text( 'старт' )
			edit.date_apply()
			$mol_assert_equal( edit.model().entities, [
				{ type: 'date_time', offset: 3, length: 5, timestamp: Date.UTC( 2026, 11, 3, 16 ) / 1000, format: 'text', timezone: 'Europe/Moscow' },
			] )

			select( 3, 8 )
			edit.date_open()
			$mol_assert_equal( [ edit.date_moment(), edit.date_zone(), edit.date_text() ], [ '2026-12-03 19:00', 'Europe/Moscow', 'старт' ] )

			edit.menu_close()
			select( 8 )
			edit.before( input( 'deleteContentBackward' ) )
			$mol_assert_equal( [ edit.model().text, seen( edit ) ], [ '😀 ', '' ] )
		},

		'Несуществующее время не применяется, двойное просит выбрать'( $ ) {
			const { edit } = stand( $, '' )
			edit.date_open()
			edit.date_zone( 'Europe/Berlin' )
			edit.date_moment( '2026-03-29 02:30' )
			$mol_assert_equal( [ edit.date_ready(), edit.date_bid() ], [ false, edit.date_missing() ] )
			edit.date_moment( '2026-10-25 02:30' )
			$mol_assert_equal( edit.date_rows().includes( edit.Date_twin_field() ), true )
			edit.date_twin( '1' )
			$mol_assert_equal( edit.stamp(), Date.UTC( 2026, 9, 25, 1, 30 ) / 1000 )
		},

		'Вставка: своё содержимое, чужой HTML, адрес поверх выделения и файлы хозяину'( $ ) {

			const { edit, select } = stand( $, 'ab' )
			select( 0, 2 )
			const data = {}
			edit.format_apply( 'spoiler' )
			edit.copy( event({ clipboardData: transfer( data ) }) )
			select( 2 )
			edit.paste( event({ clipboardData: transfer( data ) }) )
			$mol_assert_equal( [ edit.model().text, seen( edit ) ], [ 'abab', 'spoiler:ab spoiler:ab' ] )

			select( 0, 4 )
			edit.paste( event({ clipboardData: transfer({ 'text/html': '<b>x</b><img src=1 onerror="y()">', 'text/plain': 'x' }) }) )
			$mol_assert_equal( [ edit.model().text, seen( edit ) ], [ 'x', 'bold:x' ] )

			select( 0, 1 )
			edit.paste( event({ clipboardData: transfer({ 'text/plain': 'https://ya.ru' }) }) )
			$mol_assert_equal( seen( edit ), 'text_link:x bold:x' )

			let files = 0
			edit.paste_files = ( list: any )=> files = list.length
			const photo = event({ clipboardData: transfer( { 'text/html': '<img src=x>' }, [ {} as File ] ) })
			edit.paste( photo )
			$mol_assert_equal( [ files, photo.defaultPrevented, edit.model().text ], [ 1, false, 'x' ] )

		},

		'Лимит не пускает лишнее и не рвёт эмодзи'( $ ) {
			const { edit, select } = stand( $, 'ab' )
			edit.length_max = ()=> 4
			select( 2 )
			edit.paste( event({ clipboardData: transfer({ 'text/plain': 'c😀' }) }) )
			$mol_assert_equal( edit.model().text, 'abc' )
			edit.before( input( 'insertText', 'de' ) )
			$mol_assert_equal( edit.model().text, 'abcd' )
		},

		'Выключенный редактор ничего не меняет'( $ ) {
			const { edit, select } = stand( $, 'ab' )
			edit.enabled = ()=> false
			select( 0, 2 )
			edit.run( 'bold' )
			edit.undo()
			const typed = input( 'insertText', 'x' )
			edit.before( typed )
			edit.paste( event({ clipboardData: transfer({ 'text/plain': 'x' }) }) )
			$mol_assert_equal( [ edit.model(), typed.defaultPrevented ], [ { text: 'ab', entities: [] }, true ] )
		},

		'Два редактора независимы'( $ ) {
			const one = stand( $, 'ab' )
			const two = stand( $, 'ab' )
			one.select( 0, 2 )
			one.edit.format_apply( 'bold' )
			two.edit.undo()
			$mol_assert_equal( [ seen( one.edit ), seen( two.edit ) ], [ 'bold:ab', '' ] )
		},

		'Меню: порядок команд, состояния и действия внутри цитаты'( $ ) {
			const { edit, select } = stand( $, 'ab', { type: 'bold', offset: 0, length: 1 } )
			select( 0, 2 )
			edit.menu_toggle()
			$mol_assert_equal( edit.command_ids(), [ 'bold', 'italic', 'underline', 'strikethrough', 'blockquote', 'code', 'pre', 'spoiler', 'text_link', 'date_time', 'clear' ] )
			$mol_assert_equal( [ edit.command_checked( 'bold' ), edit.command_checked( 'italic' ), edit.command_enabled( 'clear' ) ], [ 'mixed', 'false', true ] )
			edit.command_click( 'blockquote' )
			$mol_assert_equal( edit.menu_showed(), false )
			edit.menu_toggle()
			edit.command_click( 'collapse' )
			$mol_assert_equal( edit.model().entities.find( mark => mark.type === 'blockquote' ), { type: 'blockquote', offset: 0, length: 2, collapsed: true } )
		},

	})

}
