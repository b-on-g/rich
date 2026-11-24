namespace $.$$ {

	export class $bog_rich_code_line extends $.$bog_rich_code_line {

		override token_type( path: number[] ) {
			const type = super.token_type( path )
			return type === 'code-link' ? 'code-word' : type
		}

	}

}
