namespace $.$$ {

	export class $bog_rich_demo extends $.$bog_rich_demo {

		@ $mol_mem
		override content( next?: $bog_rich_content ): $bog_rich_content {
			return next ?? {
				text: 'Важная встреча, старая цена 5000 ₽\nВ конце фильма все выжили, подробности на сайте\nПервая строка цитаты\nВторая\nТретья\nЧетвёртая\nfunction sum( a, b ) {\n\treturn a + b\n}\nСтавится через npm install, начало 3 декабря, 19:00',
				entities: [
					{ type: 'bold', offset: 0, length: 6 },
					{ type: 'strikethrough', offset: 28, length: 6 },
					{ type: 'spoiler', offset: 50, length: 10 },
					{ type: 'text_link', url: 'https://example.com/', offset: 77, length: 5 },
					{ type: 'blockquote', collapsed: true, offset: 83, length: 44 },
					{ type: 'pre', language: 'js', offset: 128, length: 38 },
				],
			}
		}

		@ $mol_mem
		override model_text() {
			return JSON.stringify( this.content(), null, '\t' )
		}

		@ $mol_mem
		override other( next?: $bog_rich_content ): $bog_rich_content {
			return next ?? $bog_rich_empty
		}

		@ $mol_mem
		override sent( next?: $bog_rich_content ): $bog_rich_content {
			return next ?? $bog_rich_empty
		}

		override submit( event?: Event ) {
			this.sent( $bog_rich_trim( this.other() ) )
			this.other( $bog_rich_empty )
			return null
		}

	}

}
