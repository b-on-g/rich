namespace $.$$ {

	export class $bog_rich_spoiler extends $.$bog_rich_spoiler {

		override role() {
			return this.shown() ? null! : 'button'
		}

		override tab() {
			return this.shown() ? null! : '0'
		}

		override label() {
			return this.shown() ? null! : this.hidden_label()
		}

		override body() {
			return this.shown() ? this.content() : [ this.mask() ]
		}

		@ $mol_action
		override reveal( next?: Event ) {

			if( this.shown() ) return null

			next?.preventDefault()
			next?.stopPropagation()
			this.shown( true )

			return null
		}

		@ $mol_action
		override press( next?: KeyboardEvent ) {
			if( next?.key === 'Enter' || next?.key === ' ' ) this.reveal( next )
			return null
		}

	}

}
