'use client';

import { useEffect, useRef, useState } from 'react';

interface FlowNode {
  id: string;
  label: string;
  value: number;
  color: string;
}

interface FlowLink {
  source: string;
  target: string;
  value: number;
  color: string;
}

interface MoneyFlowDiagramProps {
  totalPayment: number;
  operatorFee: number;
  netRevenue: number;
  providers: {
    name: string;
    amount: number;
    percentage: number;
    color: string;
  }[];
}

export function MoneyFlowDiagram({
  totalPayment,
  operatorFee,
  netRevenue,
  providers,
}: MoneyFlowDiagramProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 400 });
  const [isAnimating, setIsAnimating] = useState(true);

  useEffect(() => {
    const updateDimensions = () => {
      if (svgRef.current?.parentElement) {
        const width = Math.min(800, svgRef.current.parentElement.clientWidth - 32);
        setDimensions({ width, height: 400 });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    // Animation complete after 2 seconds
    const timer = setTimeout(() => setIsAnimating(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  // Build nodes
  const nodes: FlowNode[] = [
    { id: 'payment', label: `Payment\n${totalPayment.toFixed(2)} ETH`, value: totalPayment, color: '#667eea' },
    { id: 'operator', label: `Operator Fee\n${operatorFee.toFixed(4)} ETH`, value: operatorFee, color: '#9ca3af' },
    { id: 'net', label: `Net Revenue\n${netRevenue.toFixed(4)} ETH`, value: netRevenue, color: '#10b981' },
    ...providers.map((p, i) => ({
      id: `provider-${i}`,
      label: `${p.name}\n${p.amount.toFixed(4)} ETH`,
      value: p.amount,
      color: p.color.replace('bg-', '').replace('[', '').replace(']', ''),
    })),
  ];

  // Build links
  const links: FlowLink[] = [
    {
      source: 'payment',
      target: 'operator',
      value: operatorFee,
      color: '#9ca3af',
    },
    {
      source: 'payment',
      target: 'net',
      value: netRevenue,
      color: '#10b981',
    },
    ...providers.map((p, i) => ({
      source: 'net',
      target: `provider-${i}`,
      value: p.amount,
      color: p.color.replace('bg-', '').replace('[', '').replace(']', ''),
    })),
  ];

  // Calculate positions
  const nodePositions: Record<string, { x: number; y: number }> = {};
  const nodeWidth = 120;
  const nodeHeight = 80;
  const horizontalSpacing = Math.max(150, (dimensions.width - 240) / 3);
  const verticalSpacing = dimensions.height / (providers.length + 2);

  // Payment node (left)
  nodePositions.payment = { x: 60, y: dimensions.height / 2 };

  // Operator and Net nodes (middle)
  nodePositions.operator = { x: 60 + horizontalSpacing, y: dimensions.height / 3 };
  nodePositions.net = { x: 60 + horizontalSpacing, y: (dimensions.height * 2) / 3 };

  // Provider nodes (right)
  providers.forEach((_, i) => {
    const spacing = dimensions.height / (providers.length + 1);
    nodePositions[`provider-${i}`] = {
      x: 60 + horizontalSpacing * 2,
      y: spacing * (i + 1),
    };
  });

  const getPath = (source: string, target: string, value: number) => {
    const sourcePos = nodePositions[source];
    const targetPos = nodePositions[target];
    if (!sourcePos || !targetPos) return '';

    const startX = sourcePos.x + nodeWidth / 2;
    const startY = sourcePos.y;
    const endX = targetPos.x - nodeWidth / 2;
    const endY = targetPos.y;

    // Curved path
    const midX = (startX + endX) / 2;
    const controlY = startY < endY ? Math.min(startY, endY) - 20 : Math.max(startY, endY) + 20;

    return `M ${startX} ${startY} Q ${midX} ${controlY} ${endX} ${endY}`;
  };

  const getPathWidth = (value: number, maxValue: number) => {
    const minWidth = 2;
    const maxWidth = 20;
    return minWidth + (value / maxValue) * (maxWidth - minWidth);
  };

  const maxValue = Math.max(...links.map(l => l.value));

  return (
    <div className="bg-white/80 backdrop-blur-sm rounded-xl p-6 shadow-lg border border-white/20">
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-[#1a1a1a] mb-2">The Money Flow</h3>
        <p className="text-sm text-[#666666]">
          Watch how your payment flows transparently to each provider. Every transaction is visible on-chain.
        </p>
      </div>

      <div className="relative" style={{ width: '100%', height: `${dimensions.height}px` }}>
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="overflow-visible"
        >
          {/* Links (flows) */}
          <g>
            {links.map((link, i) => {
              const path = getPath(link.source, link.target, link.value);
              const width = getPathWidth(link.value, maxValue);
              const opacity = isAnimating ? 0 : 0.6;

              return (
                <g key={i}>
                  <path
                    d={path}
                    fill="none"
                    stroke={link.color}
                    strokeWidth={width}
                    strokeOpacity={opacity}
                    className="transition-all duration-1000"
                    style={{
                      strokeDasharray: isAnimating ? '1000' : '0',
                      strokeDashoffset: isAnimating ? '1000' : '0',
                      animation: isAnimating ? 'flow 2s ease-out forwards' : undefined,
                    }}
                  />
                  {/* Flow value label */}
                  {!isAnimating && (() => {
                    const sourcePos = nodePositions[link.source];
                    const targetPos = nodePositions[link.target];
                    if (!sourcePos || !targetPos) return null;
                    const midX = (sourcePos.x + targetPos.x) / 2;
                    const midY = (sourcePos.y + targetPos.y) / 2;
                    return (
                      <text
                        x={midX}
                        y={midY - 10}
                        textAnchor="middle"
                        className="text-xs font-semibold fill-[#666666]"
                      >
                        {link.value.toFixed(4)} ETH
                      </text>
                    );
                  })()}
                </g>
              );
            })}
          </g>

          {/* Nodes */}
          <g>
            {nodes.map((node) => {
              const pos = nodePositions[node.id];
              if (!pos) return null;

              return (
                <g key={node.id}>
                  <rect
                    x={pos.x - nodeWidth / 2}
                    y={pos.y - nodeHeight / 2}
                    width={nodeWidth}
                    height={nodeHeight}
                    rx={8}
                    fill={node.color}
                    fillOpacity={0.1}
                    stroke={node.color}
                    strokeWidth={2}
                    className="transition-all duration-500"
                    style={{
                      opacity: isAnimating ? 0 : 1,
                      transform: isAnimating ? 'scale(0.8)' : 'scale(1)',
                    }}
                  />
                  <text
                    x={pos.x}
                    y={pos.y - 10}
                    textAnchor="middle"
                    className="text-xs font-semibold fill-[#1a1a1a]"
                    style={{
                      opacity: isAnimating ? 0 : 1,
                    }}
                  >
                    {node.label.split('\n')[0]}
                  </text>
                  <text
                    x={pos.x}
                    y={pos.y + 10}
                    textAnchor="middle"
                    className="text-xs font-bold fill-[#667eea]"
                    style={{
                      opacity: isAnimating ? 0 : 1,
                    }}
                  >
                    {node.label.split('\n')[1]}
                  </text>
                </g>
              );
            })}
          </g>
        </svg>
      </div>

      <style jsx>{`
        @keyframes flow {
          to {
            stroke-dashoffset: 0;
          }
        }
      `}</style>
    </div>
  );
}
