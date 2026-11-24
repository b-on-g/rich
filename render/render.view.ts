namespace $.$$ {

	type Node = Exclude< $bog_rich_node, string >

	const tags: Partial< Record< $bog_rich_type, string > > = {
		bold: 'strong',
		italic: 'em',
		underline: 'u',
		strikethrough: 's',
		code: 'code',
	}

	/** Голые адреса в тексте, без закрывающих знаков на хвосте. */
	export function $bog_rich_render_links( text: string ) {

		const res = [] as { from: number, to: number }[]

		for( const found of text.matchAll( /https?:\/\/[^\s<>"«»]+/gi ) ) {

			let uri = found[0]

			while( true ) {
				const last = uri.at( -1 )!
				const pair = { ')': '(', ']': '[', '}': '{' }[ last ]
				const spare = pair ? uri.split( last ).length > uri.split( pair ).length : /[.,;:!?'*_~…]/.test( last )
				if( !spare ) break
				uri = uri.slice( 0, -1 )
			}

			if( $bog_rich_url( uri ) ) res.push({ from: found.index!, to: found.index! + uri.length })
		}

		return res
	}

	export class $bog_rich_render extends $.$bog_rich_render {

		override content(): $bog_rich_content {
			return $bog_rich_empty
		}

		@ $mol_mem
		model() {
			return $bog_rich_normalize( this.content() )
		}

		@ $mol_mem
		block_list() {
			return this.model().text ? $bog_rich_blocks( this.model() ) : []
		}

		@ $mol_mem
		override blocks() {
			return this.block_list().map( block => {
				const key = `${ block.type }_${ block.from }_${ block.to }`
				if( block.type === 'pre' ) return this.Code( key )
				if( block.type === 'blockquote' ) return this.Quote( key )
				return this.Text( key )
			} )
		}

		block( key: string ) {
			return this.block_list().find( block => `${ block.type }_${ block.from }_${ block.to }` === key )
		}

		@ $mol_mem
		nodes() {

			const res = new Map< string, Node >()

			const walk = ( nodes: readonly $bog_rich_node[] )=> {
				for( const node of nodes ) {
					if( typeof node === 'string' ) continue
					res.set( node.key, node )
					walk( node.kids )
				}
			}

			for( const block of this.block_list() ) walk( this.block_nodes( block.from, block.to ) )

			return res
		}

		block_nodes( from: number, to: number ) {
			return $bog_rich_tree( this.model(), from, to )
		}

		@ $mol_mem_key
		override block_content( key: string ) {

			const block = this.block( key )
			if( !block ) return []

			const tail = block.to === block.from || this.model().text[ block.to - 1 ] === '\n' ? [ '\n' ] : []
			return [ ... this.views( this.block_nodes( block.from, block.to ), block.from, this.auto_links() ), ... tail ]
		}

		views( nodes: readonly $bog_rich_node[], from: number, links: boolean ) {

			const res = [] as $mol_view_content[]
			let pos = from

			for( const node of nodes ) {

				if( typeof node === 'string' ) {
					res.push( ... links ? this.text_views( node, pos ) : [ node ] )
					pos += node.length
					continue
				}

				res.push( this.view( node ) )
				pos = node.to
			}

			return res
		}

		text_views( text: string, from: number ) {

			const res = [] as $mol_view_content[]
			let pos = 0

			for( const link of $bog_rich_render_links( text ) ) {
				if( link.from > pos ) res.push( text.slice( pos, link.from ) )
				res.push( this.Auto( `${ from + link.from }_${ from + link.to }` ) )
				pos = link.to
			}

			if( pos < text.length ) res.push( text.slice( pos ) )

			return res
		}

		view( node: Node ): $mol_view {
			switch( node.mark.type ) {
				case 'spoiler': return this.Spoiler( node.key )
				case 'text_link': return this.Link( node.key )
				case 'date_time': return this.Date( node.key )
			}
			return this.Mark( node.key )
		}

		linked( node: Node ) {
			return this.model().entities.some( mark =>
				( mark.type === 'text_link' || mark.type === 'code' )
				&& mark.offset <= node.from
				&& mark.offset + mark.length >= node.to
			)
		}

		@ $mol_mem_key
		override mark_content( key: string ) {
			const node = this.nodes().get( key )
			return node ? this.views( node.kids, node.from, this.auto_links() && !this.linked( node ) ) : []
		}

		override mark_tag( key: string ) {
			return tags[ key.replace( /(_\d+)+$/, '' ) as $bog_rich_type ] ?? 'span'
		}

		mark( key: string ) {
			return this.nodes().get( key )?.mark
		}

		slice( key: string ) {
			const [ , from, to ] = /(\d+)_(\d+)$/.exec( key )!
			return this.model().text.slice( Number( from ), Number( to ) )
		}

		override link_uri( key: string ) {
			const mark = this.mark( key )
			return mark?.type === 'text_link' ? mark.url : ''
		}

		override auto_uri( key: string ) {
			return this.slice( key )
		}

		override spoiler_mask( key: string ) {
			return this.slice( key ).replace( /\S/gu, '▒' )
		}

		override spoiler_shown( key: string, next?: boolean ) {
			const mark = this.mark( key )
			return mark ? this.mark_shown( `${ mark.offset }_${ mark.length }`, next ) : false
		}

		@ $mol_mem_key
		mark_shown( place: string, next?: boolean ) {
			return next ?? false
		}

		override date_text( key: string ) {
			return this.slice( key )
		}

		override date_timestamp( key: string ) {
			const mark = this.mark( key )
			return mark?.type === 'date_time' ? mark.timestamp : 0
		}

		override date_format( key: string ) {
			const mark = this.mark( key )
			return mark?.type === 'date_time' ? mark.format : 'text'
		}

		override quote_collapsed( key: string ) {
			const mark = this.block( key )?.mark
			return mark?.type === 'blockquote' && Boolean( mark.collapsed )
		}

		override code_text( key: string ) {
			return this.slice( key )
		}

		override code_language( key: string ) {
			const mark = this.block( key )?.mark
			return mark?.type === 'pre' ? mark.language ?? '' : ''
		}

		/** Содержимое без нераскрытых спойлеров, для копирования. */
		@ $mol_mem
		shown() {

			let content = this.model()

			for( const mark of [ ... content.entities ].reverse() ) {
				if( mark.type !== 'spoiler' || this.mark_shown( `${ mark.offset }_${ mark.length }` ) ) continue
				content = $bog_rich_replace( content, mark.offset, mark.offset + mark.length, '▒▒▒▒' )
			}

			return content
		}

		override shown_text() {
			return this.shown().text
		}

		override shown_html() {
			return $bog_rich_html( this.shown() )
		}

	}

}
