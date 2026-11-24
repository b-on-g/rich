namespace $ {

	function types( content: $bog_rich_content ) {
		return content.entities.map( mark => `${ mark.type }:${ content.text.slice( mark.offset, mark.offset + mark.length ) }` )
	}

	$mol_test({

		'Чужая разметка превращается в текст и знакомые стили'( $ ) {
			const got = $.$bog_rich_html_parse( '<meta charset="utf-8"><h1>Тема</h1><p>очень <b>важ<i>но</i></b> и <a href="ya.ru">ссылка</a></p><ul><li>раз</li><li>два</li></ul>' )
			$mol_assert_equal( got.text, 'Тема\nочень важно и ссылка\n• раз\n• два' )
			$mol_assert_equal( types( got ), [ 'bold:важно', 'italic:но', 'text_link:ссылка' ] )
		},

		'Опасная разметка не доезжает и не исполняется'( $ ) {
			const got = $.$bog_rich_html_parse( '<p onclick="x()">а<img src=x onerror="hack()"><script>hack()</script><svg><text>s</text></svg><iframe src="//e"></iframe><a href="javascript:x()">б</a></p>' )
			$mol_assert_equal( got, { text: 'аб', entities: [] } )
		},

		'Стили из Google Docs и Word берутся из атрибута, обёртка b с обычным весом не жирнит'( $ ) {
			const got = $.$bog_rich_html_parse( '<b style="font-weight:normal"><span style="font-weight:700">а</span><span style="font-style:italic">б</span><span style="text-decoration:line-through">в</span></b>' )
			$mol_assert_equal( types( got ), [ 'bold:а', 'italic:б', 'strikethrough:в' ] )
		},

		'Разметка из редактора возвращается тем же содержимым'( $ ) {
			const mark = ( type: string, offset: number, length: number, rest = {} )=> ({ type, offset, length, ... rest }) as $bog_rich_entity
			const content = $bog_rich_normalize({
				text: 'жир  кур\n\nцитата\nдве\nconst a = 1\n\n  b\nскрыт завтра',
				entities: [
					mark( 'bold', 0, 3 ), mark( 'italic', 5, 3 ), mark( 'blockquote', 10, 10, { collapsed: true } ),
					mark( 'pre', 21, 16, { language: 'js' } ), mark( 'spoiler', 38, 5 ),
					mark( 'date_time', 44, 6, { timestamp: 1796313600, format: 'text', timezone: 'Europe/Moscow' } ),
				],
			})
			$mol_assert_equal( $.$bog_rich_html_parse( $bog_rich_html( content ) ), content )
			const plain = $bog_rich_normalize({ text: 'a  <b>\n\nб & в', entities: [] })
			$mol_assert_equal( $.$bog_rich_html_parse( $bog_rich_html( plain ) ), plain )
		},

	})

}
