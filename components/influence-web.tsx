'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useRef } from 'react'
import type { ForceGraph3DInstance, LinkObject, NodeObject } from '3d-force-graph'

interface GraphNode extends NodeObject {
  id: string
  name: string
  isCenter: boolean
}

interface GraphLink extends LinkObject<GraphNode> {
  source: string
  target: string
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

interface InfluenceWebProps {
  centerArtist: string
  influences: string[]
  influencedBy: string[]
  accentColor: string
  onNodeClick: (name: string) => void
}

interface ForceGraphRendererProps {
  graphData: GraphData
  accentColor: string
  onNodeClick: (node: GraphNode) => void
}

type ForceGraph3DFactory = new (
  element: HTMLElement
) => ForceGraph3DInstance<GraphNode, GraphLink>

type ChargeForce = {
  strength: (strength: number) => ChargeForce
}

function createGraphData(centerArtist: string, influences: string[], influencedBy: string[]): GraphData {
  const surroundingNames = Array.from(new Set([...influences, ...influencedBy]))
  const nodes: GraphNode[] = [
    { id: centerArtist, name: centerArtist, isCenter: true },
    ...surroundingNames.map((name) => ({ id: name, name, isCenter: false })),
  ]
  const links: GraphLink[] = [
    ...influences.map((name) => ({ source: name, target: centerArtist })),
    ...influencedBy.map((name) => ({ source: centerArtist, target: name })),
  ]

  return { nodes, links }
}

function ForceGraph3DRenderer({ graphData, accentColor, onNodeClick }: ForceGraphRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const graphRef = useRef<ForceGraph3DInstance<GraphNode, GraphLink> | null>(null)
  const onNodeClickRef = useRef(onNodeClick)

  useEffect(() => {
    onNodeClickRef.current = onNodeClick
  }, [onNodeClick])

  useEffect(() => {
    let isMounted = true
    let resizeObserver: ResizeObserver | null = null

    async function mountGraph() {
      if (!containerRef.current) return

      const { default: createForceGraph3D } = await import('3d-force-graph')
      if (!isMounted || !containerRef.current) return

      const ForceGraph3DFactory = createForceGraph3D as unknown as ForceGraph3DFactory
      const graph = new ForceGraph3DFactory(containerRef.current)
        .width(containerRef.current.clientWidth)
        .height(600)
        .backgroundColor('#000000')
        .graphData(graphData)
        .nodeLabel((node) => node.name)
        .nodeColor((node) => (node.isCenter ? accentColor : '#ffffff'))
        .nodeVal((node) => (node.isCenter ? 6 : 3))
        .nodeThreeObjectExtend(false)
        .linkColor(() => 'rgba(255,255,255,0.2)')
        .linkWidth(1.5)
        .linkOpacity(0.3)
        .linkDirectionalParticles(2)
        .linkDirectionalParticleSpeed(0.005)
        .onNodeClick((node) => {
          onNodeClickRef.current(node)
        })
        .enableNodeDrag(true)
        .enableNavigationControls(true)
        .warmupTicks(100)
        .cooldownTicks(200)
        .d3AlphaDecay(0.02)
        .d3VelocityDecay(0.3)
        .showNavInfo(false)

      const chargeForce = graph.d3Force('charge') as ChargeForce | undefined
      chargeForce?.strength(-150)
      graphRef.current = graph

      resizeObserver = new ResizeObserver(([entry]) => {
        graph.width(entry.contentRect.width).height(600)
      })
      resizeObserver.observe(containerRef.current)
    }

    mountGraph()

    return () => {
      isMounted = false
      resizeObserver?.disconnect()
      graphRef.current?._destructor()
      graphRef.current = null
    }
  }, [graphData, accentColor])

  return <div ref={containerRef} className="w-full h-[600px]" />
}

const ForceGraph3D = dynamic(() => import('3d-force-graph').then(() => ForceGraph3DRenderer), {
  ssr: false,
})

export function InfluenceWeb({
  centerArtist,
  influences,
  influencedBy,
  accentColor,
  onNodeClick,
}: InfluenceWebProps) {
  const graphData = useMemo(
    () => createGraphData(centerArtist, influences, influencedBy),
    [centerArtist, influences, influencedBy]
  )

  return (
    <div>
      <h2 className="text-muted-foreground text-sm uppercase tracking-[0.2em] mb-8 font-mono px-8">
        THE WEB
      </h2>
      <ForceGraph3D
        graphData={graphData}
        accentColor={accentColor}
        onNodeClick={(node) => {
          if (!node.isCenter) {
            onNodeClick(node.name)
          }
        }}
      />
    </div>
  )
}
