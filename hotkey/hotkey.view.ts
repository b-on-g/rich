namespace $.$$ {

	const names: Record< string, string > = {
		Period: 'period',
		Enter: 'enter',
		NumpadEnter: 'enter',
		Tab: 'tab',
		ArrowDown: 'down',
	}

	/** Хоткеи по физической клавише. На маке командная клавиша только Cmd, Ctrl остаётся системе. */
	export class $bog_rich_hotkey extends $.$bog_rich_hotkey {

		@ $mol_mem
		override mac() {
			const nav = this.$.$mol_dom_context.navigator
			return /Mac|iP(hone|ad|od)/.test( nav?.platform || nav?.userAgent || '' )
		}

		name( event: KeyboardEvent ) {

			const code = event.code ?? ''
			const key = /^Key([A-Z])$/.exec( code )?.[1] ?? names[ code ] ?? names[ event.key ] ?? $mol_keyboard_code[ event.keyCode ] ?? '?'

			const mod = this.mac() ? event.metaKey : event.ctrlKey
			const alien = this.mac() ? event.ctrlKey : event.metaKey

			return [
				... mod ? [ 'ctrl' ] : [],
				... alien ? [ 'alien' ] : [],
				... event.altKey ? [ 'alt' ] : [],
				... event.shiftKey ? [ 'shift' ] : [],
				key,
			].join( '_' )
		}

		override keydown( event?: KeyboardEvent ) {

			if( !event || event.defaultPrevented ) return
			if( event.isComposing || event.keyCode === 229 ) return

			const action = this.action() as Record< string, undefined | ( ( event: KeyboardEvent )=> any ) >
			action[ this.name( event ) ]?.( event )

		}

	}

}
