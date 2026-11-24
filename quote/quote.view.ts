namespace $.$$ {

	export class $bog_rich_quote extends $.$bog_rich_quote {

		override clamped() {
			return this.collapsed() && !this.opened()
		}

		override Toggle() {
			return this.collapsed() && this.long() ? super.Toggle() : null!
		}

		@ $mol_mem
		measure() {

			this.$.$mol_window.size()
			this.content()
			if( !this.clamped() ) return null

			return new this.$.$mol_after_frame( ()=> {
				const node = this.Text().dom_node()
				this.long( node.scrollHeight > node.clientHeight + 1 )
			} )
		}

		override auto() {
			return [ this.measure() ]
		}

	}

}
