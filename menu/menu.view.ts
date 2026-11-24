namespace $.$$ {

	type Rect = { left: number, right: number, top: number, bottom: number, width: number, height: number }

	const typed = 'input, textarea, select'

	/** Всплывающее меню у выделения или кнопки, которое не отбирает фокус у редактора. */
	export class $bog_rich_menu extends $.$bog_rich_menu {

		override spot( next?: Rect | null ) {
			return next ?? null as Rect | null
		}

		@ $mol_mem
		override spot_rect() {
			return ( this.spot() ?? this.Trigger().view_rect() ) as any
		}

		@ $mol_mem
		screen() {

			const size = this.$.$mol_window.size()
			if( this.showed() ) $mol_wire_watch()

			const view = this.$.$mol_dom_context.visualViewport
			const top = view?.offsetTop ?? 0

			return { top, bottom: top + ( view?.height ?? size.height ) }
		}

		override anchor_visible() {
			return true
		}

		@ $mol_mem
		override align_vert() {
			const rect = this.spot_rect() as Rect | null
			if( !rect ) return 'suspense'
			const { top, bottom } = this.screen()
			return rect.top - top > bottom - rect.bottom ? 'top' : 'bottom'
		}

		override align_hor() {
			return 'center'
		}

		@ $mol_mem
		override height_max() {
			const rect = this.spot_rect() as Rect | null
			if( !rect ) return 0
			const { top, bottom } = this.screen()
			return Math.max( 120, this.align_vert() === 'top' ? rect.top - top : bottom - rect.bottom )
		}

		@ $mol_mem
		outside() {

			if( !this.showed() ) return null

			return new this.$.$mol_dom_listener(
				this.$.$mol_dom_context.document,
				'pointerdown',
				( event: Event )=> {
					if( !this.dom_node().contains( event.target as Node ) ) this.showed( false )
				},
			)
		}

		override auto() {
			return [ ... super.auto(), this.outside() ] as any
		}

		free( event?: Event ) {
			const target = event?.target as Element | null
			return !this.list() || Boolean( target?.closest?.( typed ) )
		}

		override hold( event?: Event ) {
			if( !this.free( event ) ) event!.preventDefault()
			return null
		}

		touch_at = null as null | { x: number, y: number }

		override touch( event?: TouchEvent ) {
			const touch = event?.touches.length === 1 ? event.touches[0] : null
			this.touch_at = touch && { x: touch.clientX, y: touch.clientY }
			return null
		}

		override tap( event?: TouchEvent ) {

			const from = this.touch_at
			const touch = event?.changedTouches[0]
			this.touch_at = null

			if( !from || !touch || !event.cancelable || this.free( event ) ) return null
			if( Math.hypot( touch.clientX - from.x, touch.clientY - from.y ) > 10 ) return null

			event.preventDefault()
			;( event.target as Element ).closest< HTMLElement >( '[mol_button]' )?.click()

			return null
		}

		override press( event?: KeyboardEvent ) {

			if( !event || event.defaultPrevented ) return null

			if( event.key === 'Escape' && this.showed() ) {
				event.preventDefault()
				event.stopPropagation()
				this.escape( event )
			}

			if( event.key === ' ' && !this.free( event ) ) {
				event.preventDefault()
				;( event.target as Element ).closest< HTMLElement >( '[mol_button]' )?.click()
			}

			return null
		}

	}

}
