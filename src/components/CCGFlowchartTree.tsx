import { useLayoutEffect, useRef, useState } from 'react';
import { TeamLogoFor } from './TeamLogo';
import { formatKickoff, formatShortDate } from '../utils/dateUtils';
import { LOCKED_CONFIDENCE_THRESHOLD } from '../utils/ccgFlowchartTree';
import type { FlowchartLeafNode, PositionedNode, TreeLayout } from '../utils/ccgFlowchartTree';
import type { SeasonTeams } from '../types';

interface CCGFlowchartTreeProps {
  teams: SeasonTeams;
  layout: TreeLayout;
  onSelectWinner: (game: string, winner: string) => void;
  showNames: boolean;
}


interface Dims {
  nodeWidth: number;
  leafWidth: number; // pixels-per-leaf-slot in the tidy-tree x-coordinate system
  leafBoxWidth: number; // a leaf's own rendered box width (independent of leafWidth spacing)
  rowHeight: number;
  nodeHeight: number; // baseline used for vertical centering/spacing before a box's real height is measured
}

// Node/leaf boxes shrink a lot once team names aren't rendered — only logos
// (and, for game nodes, win%) remain — so rows can pack much closer together
// and leaf boxes only need to be as wide as their two logos.
const DIMS_SHOWN: Dims = { nodeWidth: 142, leafWidth: 155, leafBoxWidth: 142, rowHeight: 88, nodeHeight: 50 };
const DIMS_HIDDEN: Dims = { nodeWidth: 74, leafWidth: 90, leafBoxWidth: 50, rowHeight: 58, nodeHeight: 40 };

function centerOf(node: PositionedNode, dims: Dims): { x: number; y: number } {
  return { x: node.x * dims.leafWidth, y: node.y * dims.rowHeight + dims.nodeHeight / 2 };
}

function matchupKeyOf(node: FlowchartLeafNode): string | null {
  const top = node.topMatchups[0];
  if (!top) return null;
  return [...top.teams].sort().join('_vs_');
}

/** Every node in `node`'s own subtree, including `node` itself. */
function collectDescendants(node: PositionedNode, out: Set<PositionedNode>) {
  out.add(node);
  if (node.team1Branch) collectDescendants(node.team1Branch, out);
  if (node.team2Branch) collectDescendants(node.team2Branch, out);
}

/** "#RRGGBB" (or "#RGB") -> "rgba(r, g, b, alpha)", for team-colored highlights. */
function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const r = parseInt(full.substring(0, 2), 16);
  const g = parseInt(full.substring(2, 4), 16);
  const b = parseInt(full.substring(4, 6), 16);
  if ([r, g, b].some(Number.isNaN)) return `rgba(107, 114, 128, ${alpha})`; // gray-500 fallback
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

interface EdgeInfo {
  id: number;
  from: PositionedNode;
  to: PositionedNode;
  winner: string;
  gameKey: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  winProb: number;
}

interface TreeAnalysis {
  nodes: PositionedNode[];
  edges: EdgeInfo[];
  pathToNode: Map<PositionedNode, EdgeInfo[]>;
  matchupGroups: Map<string, PositionedNode[]>;
}

/** Walks the tree once, computing pixel-accurate edges (using real measured
 * node heights so lines start/end exactly on each box's border), each
 * node's root-to-node edge path (for hover highlighting), and leaf nodes
 * grouped by resulting matchup (for "highlight all other ways this happens").
 *
 * Each game node's two outgoing lines start from different points along its
 * bottom edge — center-left for the away team (team1), center-right for the
 * home team (team2) — so which line is which is visually obvious without a
 * label on the line itself. */
function analyzeTree(root: PositionedNode, dims: Dims, halfHeightOf: (n: PositionedNode) => number): TreeAnalysis {
  const nodes: PositionedNode[] = [];
  const edges: EdgeInfo[] = [];
  const pathToNode = new Map<PositionedNode, EdgeInfo[]>();
  const matchupGroups = new Map<string, PositionedNode[]>();

  function walk(node: PositionedNode, path: EdgeInfo[]) {
    nodes.push(node);
    pathToNode.set(node, path);

    if (node.node.type === 'leaf') {
      const key = matchupKeyOf(node.node);
      if (key) {
        if (!matchupGroups.has(key)) matchupGroups.set(key, []);
        matchupGroups.get(key)!.push(node);
      }
      return;
    }
    if (node.node.type !== 'game' || !node.team1Branch || !node.team2Branch) return;

    const [team1, team2] = node.node.game;
    const from = centerOf(node, dims);
    const fromBottom = from.y + halfHeightOf(node);

    const id1 = edges.length;
    const to1 = centerOf(node.team1Branch, dims);
    const edge1: EdgeInfo = {
      id: id1,
      from: node,
      to: node.team1Branch,
      winner: team1,
      gameKey: node.node.gameKey,
      x1: from.x - dims.nodeWidth / 4,
      y1: fromBottom,
      x2: to1.x,
      y2: to1.y - halfHeightOf(node.team1Branch),
      winProb: node.node.awayWinProb,
    };

    const id2 = edges.length + 1;
    const to2 = centerOf(node.team2Branch, dims);
    const edge2: EdgeInfo = {
      id: id2,
      from: node,
      to: node.team2Branch,
      winner: team2,
      gameKey: node.node.gameKey,
      x1: from.x + dims.nodeWidth / 4,
      y1: fromBottom,
      x2: to2.x,
      y2: to2.y - halfHeightOf(node.team2Branch),
      winProb: 1 - node.node.awayWinProb,
    };

    edges.push(edge1, edge2);
    walk(node.team1Branch, [...path, edge1]);
    walk(node.team2Branch, [...path, edge2]);
  }

  walk(root, []);
  return { nodes, edges, pathToNode, matchupGroups };
}

export function CCGFlowchartTree({ teams, layout, onSelectWinner, showNames }: CCGFlowchartTreeProps) {
  const dims: Dims = showNames ? DIMS_SHOWN : DIMS_HIDDEN;

  const boxRefs = useRef(new Map<PositionedNode, HTMLDivElement>());
  const [heights, setHeights] = useState<Map<PositionedNode, number>>(new Map());

  const [hoveredLeaf, setHoveredLeaf] = useState<PositionedNode | null>(null);
  // The specific (gameKey, team) button under the cursor — powers both
  // "grey out what this pick eliminates" (gameKey-scoped) and "highlight
  // every other place this team could still win" (team-scoped, whole tree).
  const [hoveredWinner, setHoveredWinner] = useState<{ gameKey: string; team: string } | null>(null);

  // Clear hover state when the tree itself changes (new selections), without
  // calling setState directly inside an effect — see React's "Resetting all
  // state when a prop changes" pattern.
  const [trackedLayout, setTrackedLayout] = useState(layout);
  if (trackedLayout !== layout) {
    setTrackedLayout(layout);
    setHoveredLeaf(null);
    setHoveredWinner(null);
  }

  // Measure each node box's real rendered height so edges (computed below)
  // start/end exactly on the boxes' actual borders instead of an assumed
  // constant height. A ResizeObserver (rather than a one-shot read) also
  // self-corrects if box sizes change later (e.g. a logo image loading in).
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => {
      setHeights((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const [node, el] of boxRefs.current) {
          const h = el.offsetHeight;
          if (next.get(node) !== h) {
            next.set(node, h);
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    });
    for (const el of boxRefs.current.values()) observer.observe(el);
    return () => observer.disconnect();
  }, [layout]);

  const halfHeightOf = (n: PositionedNode) => (heights.get(n) ?? dims.nodeHeight) / 2;
  const { nodes, edges, pathToNode, matchupGroups } = analyzeTree(layout.root, dims, halfHeightOf);

  // Hovering a final outcome: highlight every other leaf with the same
  // matchup, and every edge on the root-to-leaf path for each of them.
  const highlightedEdgeIds = new Set<number>();
  const highlightedLeaves = new Set<PositionedNode>();
  if (hoveredLeaf && hoveredLeaf.node.type === 'leaf') {
    const key = matchupKeyOf(hoveredLeaf.node);
    const group = key ? (matchupGroups.get(key) ?? []) : [];
    for (const leaf of group) {
      highlightedLeaves.add(leaf);
      for (const e of pathToNode.get(leaf) ?? []) highlightedEdgeIds.add(e.id);
    }
  }

  // Hovering a team button: grey out everything that picking it would make
  // irrelevant (scoped to that specific game — the same game can appear as
  // a decision point at more than one place in the tree, so this prunes
  // every occurrence of that gameKey, not just the one under the cursor)...
  const greyedNodes = new Set<PositionedNode>();
  const greyedEdgeIds = new Set<number>();
  // ...and separately, highlight every other instance of that SAME TEAM as
  // a possible winner anywhere in the tree, in that team's own color.
  const teamHighlightEdgeIds = new Set<number>();
  if (hoveredWinner) {
    for (const e of edges) {
      if (e.gameKey === hoveredWinner.gameKey && e.winner !== hoveredWinner.team) {
        greyedEdgeIds.add(e.id);
        collectDescendants(e.to, greyedNodes);
      }
    }
    for (const e of edges) {
      if (greyedNodes.has(e.from)) greyedEdgeIds.add(e.id);
    }
    for (const e of edges) {
      if (e.winner === hoveredWinner.team && !greyedEdgeIds.has(e.id)) teamHighlightEdgeIds.add(e.id);
    }
  }
  const hoveredTeamColor = hoveredWinner ? teams.teams[hoveredWinner.team]?.primary_color : undefined;

  const width = Math.max(layout.totalLeaves * dims.leafWidth, dims.nodeWidth);
  // Deepest row's boxes are centered at `maxDepth * rowHeight + nodeHeight / 2`
  // (see centerOf), so their bottom edge sits at roughly
  // `maxDepth * rowHeight + nodeHeight`. The extra `+ nodeHeight` beyond that
  // (rather than a full extra `+ rowHeight`, as this used to add) covers
  // boxes taller than the nodeHeight baseline (e.g. a leaf showing a tied,
  // coin-flip matchup spans 2-3 lines) without leaving a whole empty row's
  // worth of dead space below the tree.
  const height = layout.maxDepth * dims.rowHeight + dims.nodeHeight * 2 + 12;

  return (
    <div className="relative" style={{ width, height }}>
      <svg className="absolute inset-0 pointer-events-none" width={width} height={height}>
        {edges.map((edge) => {
          const isHighlighted = highlightedEdgeIds.has(edge.id);
          const isTeamHighlighted = teamHighlightEdgeIds.has(edge.id) && hoveredTeamColor;
          const isGreyed = greyedEdgeIds.has(edge.id);
          return (
            <line
              key={edge.id}
              x1={edge.x1}
              y1={edge.y1}
              x2={edge.x2}
              y2={edge.y2}
              className={
                isHighlighted
                  ? 'stroke-blue-500'
                  : isTeamHighlighted
                    ? undefined
                    : isGreyed
                      ? 'stroke-gray-200 dark:stroke-gray-700'
                      : 'stroke-gray-300 dark:stroke-gray-600'
              }
              style={isTeamHighlighted ? { stroke: hexToRgba(hoveredTeamColor, 0.8) } : undefined}
              strokeWidth={isHighlighted || isTeamHighlighted ? 3 : 2}
            />
          );
        })}
      </svg>

      {nodes.map((positioned, i) => {
        const { node } = positioned;
        const { x, y } = centerOf(positioned, dims);
        const boxWidth = node.type === 'leaf' ? dims.leafBoxWidth : dims.nodeWidth;
        const style = { left: x, top: y, width: boxWidth, transform: 'translate(-50%, -50%)' } as const;
        const isGreyed = greyedNodes.has(positioned);
        const isHighlightedLeaf = highlightedLeaves.has(positioned);

        const registerRef = (el: HTMLDivElement | null) => {
          if (el) boxRefs.current.set(positioned, el);
          else boxRefs.current.delete(positioned);
        };

        if (node.type === 'leaf') {
          const top = node.topMatchups[0];
          if (!top) {
            return (
              <div
                key={i}
                ref={registerRef}
                className={`absolute rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 px-1 py-1 text-center ${
                  isGreyed ? 'opacity-30' : ''
                }`}
                style={style}
              >
                <p className="text-[10px] text-gray-500 dark:text-gray-400">No CCG data</p>
              </div>
            );
          }
          const locked = top.probability >= LOCKED_CONFIDENCE_THRESHOLD;
          return (
            <div
              key={i}
              ref={registerRef}
              onMouseEnter={() => setHoveredLeaf(positioned)}
              onMouseLeave={() => setHoveredLeaf((h) => (h === positioned ? null : h))}
              className={`absolute rounded-lg border-2 px-1 py-1 cursor-default transition-opacity ${
                locked
                  ? 'border-green-500 dark:border-green-700 bg-green-50 dark:bg-green-500/10'
                  : 'border-amber-500 dark:border-amber-700 bg-amber-50 dark:bg-amber-500/10'
              } ${isHighlightedLeaf ? 'ring-2 ring-blue-500' : ''} ${isGreyed ? 'opacity-30' : ''}`}
              style={style}
            >
              {node.topMatchups.slice(0, locked ? 1 : 2).map((m, mi) => (
                <div key={mi} className={`flex items-center justify-center gap-1 ${mi > 0 ? 'mt-0.5' : ''}`}>
                  <TeamLogoFor team={m.teams[0]} teams={teams} size="xs" />
                  {showNames && (
                    <span className="text-[11px] font-medium">{teams.teams[m.teams[0]]?.abbreviation ?? m.teams[0]}</span>
                  )}
                  {showNames && <span className="text-[9px] text-gray-400">vs</span>}
                  <TeamLogoFor team={m.teams[1]} teams={teams} size="xs" />
                  {showNames && (
                    <span className="text-[11px] font-medium">{teams.teams[m.teams[1]]?.abbreviation ?? m.teams[1]}</span>
                  )}
                  {!locked && (
                    <span className="text-[9px] font-mono text-gray-500 dark:text-gray-400">
                      {(m.probability * 100).toFixed(0)}%
                    </span>
                  )}
                </div>
              ))}
              {!locked && (
                <p className="text-[9px] text-amber-700 dark:text-amber-300 text-center">Tied — decided by coin flip</p>
              )}
            </div>
          );
        }

        const [team1, team2] = node.game;
        const team1Color = teams.teams[team1]?.primary_color;
        const team2Color = teams.teams[team2]?.primary_color;
        const team1Highlighted = hoveredWinner?.team === team1 && team1Color;
        const team2Highlighted = hoveredWinner?.team === team2 && team2Color;

        return (
          <div
            key={i}
            ref={registerRef}
            className={`absolute rounded-lg border-2 border-gray-300 dark:border-gray-400 bg-white dark:bg-gray-800 shadow-sm transition-opacity overflow-hidden ${
              isGreyed ? 'opacity-30' : ''
            }`}
            style={style}
          >
            {/* Shown mode: date/kickoff + win% on top, team names on the
                bottom row, right above where their corresponding lines
                start, so the winner-to-child-node connection reads clearly.
                Hidden mode: no header at all — win% moves to small text
                right under each team's logo instead, and rows pack closer
                together (see DIMS_HIDDEN). */}
            {showNames && (
              <div className="flex items-center justify-between px-1 pt-0.5 border-b border-gray-200 dark:border-gray-700">
                <span className="text-[9px] font-mono text-gray-500 dark:text-gray-400">
                  {Math.round(node.awayWinProb * 100)}%
                </span>
                {node.date && (
                  <span className="text-[9px] text-gray-400 dark:text-gray-500">
                    {formatShortDate(node.date)}
                    {formatKickoff(node.kickoff) && ` · ${formatKickoff(node.kickoff)}`}
                  </span>
                )}
                <span className="text-[9px] font-mono text-gray-500 dark:text-gray-400">
                  {Math.round((1 - node.awayWinProb) * 100)}%
                </span>
              </div>
            )}
            <div className="flex items-center">
              <button
                onClick={() => onSelectWinner(node.gameKey, team1)}
                onMouseEnter={() => setHoveredWinner({ gameKey: node.gameKey, team: team1 })}
                onMouseLeave={() =>
                  setHoveredWinner((h) => (h?.gameKey === node.gameKey && h.team === team1 ? null : h))
                }
                style={team1Highlighted ? { backgroundColor: hexToRgba(team1Color, 0.3) } : undefined}
                className={`flex-1 min-w-0 flex py-1 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors ${
                  showNames ? 'items-center justify-center gap-1' : 'flex-col items-center justify-center gap-0.5'
                }`}
              >
                <TeamLogoFor team={team1} teams={teams} size="xs" />
                {showNames ? (
                  <span className="text-[11px] font-medium truncate">{teams.teams[team1]?.abbreviation ?? team1}</span>
                ) : (
                  <span className="text-[7px] font-mono leading-none text-gray-500 dark:text-gray-400">
                    {Math.round(node.awayWinProb * 100)}%
                  </span>
                )}
              </button>
              <span className="text-[9px] text-gray-400 px-0.5">@</span>
              <button
                onClick={() => onSelectWinner(node.gameKey, team2)}
                onMouseEnter={() => setHoveredWinner({ gameKey: node.gameKey, team: team2 })}
                onMouseLeave={() =>
                  setHoveredWinner((h) => (h?.gameKey === node.gameKey && h.team === team2 ? null : h))
                }
                style={team2Highlighted ? { backgroundColor: hexToRgba(team2Color, 0.3) } : undefined}
                className={`flex-1 min-w-0 flex py-1 hover:bg-blue-50 dark:hover:bg-blue-500/10 transition-colors ${
                  showNames ? 'items-center justify-center gap-1' : 'flex-col items-center justify-center gap-0.5'
                }`}
              >
                <TeamLogoFor team={team2} teams={teams} size="xs" />
                {showNames ? (
                  <span className="text-[11px] font-medium truncate">{teams.teams[team2]?.abbreviation ?? team2}</span>
                ) : (
                  <span className="text-[7px] font-mono leading-none text-gray-500 dark:text-gray-400">
                    {Math.round((1 - node.awayWinProb) * 100)}%
                  </span>
                )}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
