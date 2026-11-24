namespace $ {

	const blocks = new Set([ 'P', 'DIV', 'SECTION', 'LI', 'PRE', 'BLOCKQUOTE', 'UL', 'OL' ])

	const tags: Partial< Record< $bog_rich_type, string > > = {
		bold: 'strong',
		italic: 'em',
		underline: 'u',
		strikethrough: 's',
		code: 'code',
	}

	type Leaf = { node: Node, from: number, to: number }

	export type $bog_rich_dom_map = {
		text: string
		leaves: readonly Leaf[]
		lines: readonly { el: Node, from: number, to: number }[]
	}

	function block_is( node: Node | null ) {
		return !!node && blocks.has( node.nodeName )
	}

	/** Читает текст редактируемой области и места её узлов в нём. */
	export function $bog_rich_dom_read( root: Node ): $bog_rich_dom_map {

		const leaves = [] as Leaf[]
		const lines = [] as { el: Node, from: number, to: number }[]
		let text = ''

		const line = ( el: Node, nodes: readonly Node[] )=> {

			if( lines.length ) text += '\n'
			const from = text.length

			const flat = ( node: Node ): Node[] => node.nodeType === 3 || node.nodeName === 'BR' ? [ node ] : [ ... node.childNodes ].flatMap( flat )
			const list = nodes.flatMap( flat )

			for( const [ index, node ] of list.entries() ) {
				const start = text.length
				if( node.nodeType === 3 ) text += node.nodeValue!.replace( /\r\n?/g, '\n' )
				else if( index < list.length - 1 ) text += '\n'
				leaves.push({ node, from: start, to: text.length })
			}

			lines.push({ el, from, to: text.length })
		}

		const walk = ( box: Node )=> {

			const kids = [ ... box.childNodes ]
			if( box !== root && !kids.some( block_is ) ) return line( box, kids )

			let loose = [] as Node[]
			const flush = ()=> {
				if( loose.length ) line( box, loose )
				loose = []
			}

			for( const kid of kids ) {
				if( block_is( kid ) ) {
					flush()
					walk( kid )
				} else if( kid.nodeType === 3 || kid.nodeType === 1 ) {
					loose.push( kid )
				}
			}

			flush()
		}

		walk( root )

		return { text, leaves, lines }
	}

	/** Позиция в тексте для точки документа. */
	export function $bog_rich_dom_offset( map: $bog_rich_dom_map, root: Node, node: Node, pos: number ): number {

		const own = map.leaves.find( leaf => leaf.node === node )
		if( own ) return node.nodeType === 3 ? Math.min( own.from + pos, own.to ) : own.from

		const inside = ( host: Node )=> {
			const leaves = map.leaves.filter( leaf => host.contains( leaf.node ) )
			const lines = map.lines.filter( line => line.el !== root && host.contains( line.el ) )
			const froms = [ ... leaves, ... lines ].map( item => item.from )
			const tos = [ ... leaves, ... lines ].map( item => item.to )
			return froms.length ? [ Math.min( ... froms ), Math.max( ... tos ) ] : null
		}

		const next = node.childNodes[ pos ]
		const after = next && inside( next )
		if( after ) return after[0]

		for( let index = Math.min( pos, node.childNodes.length ) - 1; index >= 0; -- index ) {
			const before = inside( node.childNodes[ index ] )
			if( before ) return before[1]
		}

		return inside( node )?.[0] ?? 0
	}

	/** Точка документа для позиции в тексте. */
	export function $bog_rich_dom_point( map: $bog_rich_dom_map, root: Node, offset: number ): readonly[ Node, number ] {

		const line = map.lines.find( line => offset >= line.from && offset <= line.to ) ?? map.lines.at( -1 )
		if( !line ) return [ root, 0 ]

		const leaves = map.leaves.filter( leaf => leaf.from >= line.from && leaf.to <= line.to && line.el.contains( leaf.node ) )

		const hit = leaves.find( leaf => {
			if( leaf.node.nodeType !== 3 || offset < leaf.from || offset > leaf.to ) return false
			return !leaf.node.parentElement?.closest( '[contenteditable="false"]' )
		} )
		if( hit ) return [ hit.node, offset - hit.from ]

		const next = leaves.find( leaf => leaf.from >= offset )
		const spot = next ?? leaves.at( -1 )
		if( !spot ) return [ line.el, 0 ]

		const atom = spot.node.parentElement?.closest( '[contenteditable="false"]' )
		const node = atom && root.contains( atom ) ? atom : spot.node
		const shift = next ? 0 : 1

		return [ node.parentNode!, [ ... node.parentNode!.childNodes ].indexOf( node as ChildNode ) + shift ]
	}

	/** Строит узлы редактируемой области по содержимому. */
	export function $bog_rich_dom_build( document: Document, content: $bog_rich_content ): readonly Element[] {

		const draw = ( node: $bog_rich_node ): Node => {

			if( typeof node === 'string' ) return document.createTextNode( node )

			const { mark } = node
			const el = document.createElement( tags[ mark.type ] ?? 'span' )
			if( !tags[ mark.type ] ) el.setAttribute( 'data-rich', mark.type )
			if( mark.type === 'text_link' ) el.setAttribute( 'title', mark.url )
			if( mark.type === 'date_time' ) el.setAttribute( 'contenteditable', 'false' )
			el.append( ... node.kids.map( draw ) )

			return el
		}

		const lines = ( from: number, to: number )=> {

			const res = [] as Element[]
			let pos = from

			while( true ) {

				const [ , tail ] = $bog_rich_line( content.text, pos )
				const line = document.createElement( 'div' )
				const nodes = $bog_rich_tree( content, pos, tail )
				line.append( ... nodes.map( draw ) )

				const last = nodes.at( -1 )
				if( !last || typeof last !== 'string' && last.mark.type === 'date_time' ) line.append( document.createElement( 'br' ) )

				res.push( line )
				if( tail >= to ) return res
				pos = tail + 1
			}

		}

		return $bog_rich_blocks( content ).flatMap( block => {

			const list = lines( block.from, block.to )
			if( !block.mark ) return list

			const box = document.createElement( block.type )
			if( block.mark.type === 'blockquote' && block.mark.collapsed ) box.setAttribute( 'data-collapsed', '' )
			if( block.mark.type === 'pre' ) {
				box.setAttribute( 'spellcheck', 'false' )
				if( block.mark.language ) box.setAttribute( 'data-language', block.mark.language )
			}
			box.append( ... list )

			return [ box ]
		} )
	}

	/** Приводит область к содержимому, не трогая совпавшие узлы. Отвечает, менялось ли что-то. */
	export function $bog_rich_dom_draw( root: Element, content: $bog_rich_content ) {

		const next = [ ... $bog_rich_dom_build( root.ownerDocument, content ) ]
		const prev = [ ... root.childNodes ]
		const same = ( left: Node, right: Node )=> left.isEqualNode( right )

		let head = 0
		while( head < prev.length && head < next.length && same( prev[ head ], next[ head ] ) ) ++ head

		let tail = 0
		while( tail < prev.length - head && tail < next.length - head && same( prev[ prev.length - 1 - tail ], next[ next.length - 1 - tail ] ) ) ++ tail

		const drop = prev.slice( head, prev.length - tail )
		const add = next.slice( head, next.length - tail )
		if( !drop.length && !add.length ) return false

		const anchor = prev[ prev.length - tail ] ?? null
		for( const node of drop ) node.remove()
		for( const node of add ) root.insertBefore( node, anchor )

		return true
	}

}
