namespace $ {

	/** История правок одного значения. Частые правки копятся в одну запись, новая правка стирает возврат. */
	export class $bog_rich_story< Shot > extends $mol_object2 {

		past = [] as { prev: Shot, next: Shot }[]
		future = [] as { prev: Shot, next: Shot }[]
		open = false
		delay = 500
		timer = null as null | $mol_after_timeout

		constructor( readonly apply: ( shot: Shot )=> void ) {
			super()
		}

		stage( prev: Shot, next: Shot ) {

			this.future.length = 0

			if( this.open ) this.past.at( -1 )!.next = next
			else this.past.push({ prev, next })

			this.open = true
			this.timer?.destructor()
			this.timer = new this.$.$mol_after_timeout( this.delay, ()=> this.seal() )
		}

		seal() {
			this.timer?.destructor()
			this.timer = null
			this.open = false
		}

		backward() {

			this.seal()

			const twist = this.past.pop()
			if( !twist ) return

			this.future.push( twist )
			this.apply( twist.prev )
		}

		forward() {

			this.seal()

			const twist = this.future.pop()
			if( !twist ) return

			this.past.push( twist )
			this.apply( twist.next )
		}

		clear() {
			this.seal()
			this.past.length = 0
			this.future.length = 0
		}

	}

}
