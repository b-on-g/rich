namespace $.$$ {

	export class $bog_rich_date extends $.$bog_rich_date {

		now() {
			const tick = $bog_rich_zone_tick( this.timestamp() - Date.now() / 1000 )
			return Math.floor( this.$.$mol_state_time.now( tick ) / 1000 )
		}

		lang() {
			return this.$.$mol_locale.lang()
		}

		@ $mol_mem
		override label() {
			const format = this.format() as $bog_rich_date_format
			if( format === 'text' ) return this.text()
			return $bog_rich_zone_text( this.timestamp(), format, this.lang(), format === 'relative' ? this.now() : 0 )
		}

		@ $mol_mem
		override full() {
			return $bog_rich_zone_full( this.timestamp(), this.lang() )
		}

		override ics() {
			const text = $bog_rich_zone_ics( this.timestamp(), this.text(), Math.floor( Date.now() / 1000 ) )
			return new this.$.$mol_blob( [ text ], { type: 'text/calendar' } )
		}

	}

}
