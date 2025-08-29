'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { getCurrentDeltaContent } from '@/lib/node-history-delta';
import { MobileHeader } from '@/components/mobile-header';
import type { Edge, Node } from '@xyflow/react';
import { useState } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';

type Project = {
  id: string;
  title: string;
  updatedAt: string;
  userId: string;
};

interface MobileNotesViewProps {
  nodes: Node[];
  edges: Edge[];
  projects: Project[];
  currentProjectId: string;
  onUpdateNode?: (nodeId: string, data: any) => void;
}

export const MobileNotesView = ({ nodes, edges, projects, currentProjectId }: MobileNotesViewProps) => {
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());

  const toggleExpanded = (noteId: string) => {
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(noteId)) {
        newSet.delete(noteId);
      } else {
        newSet.add(noteId);
      }
      return newSet;
    });
  };

  // Get connections for a specific node
  const getConnectedNotes = (nodeId: string) => {
    const connectedEdges = edges.filter(edge => 
      edge.source === nodeId || edge.target === nodeId
    );
    
    return connectedEdges.map(edge => {
      const connectedNodeId = edge.source === nodeId ? edge.target : edge.source;
      const connectedNode = nodes.find(n => n.id === connectedNodeId);
      const direction = edge.source === nodeId ? 'outgoing' : 'incoming';
      
      return {
        id: connectedNodeId,
        title: connectedNode?.data?.title || getNodeTypeLabel(connectedNode?.type || ''),
        type: connectedNode?.type,
        direction
      };
    });
  };

  const getNodeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      text: 'Text',
      image: 'Image', 
      audio: 'Audio',
      video: 'Video',
      code: 'Code',
      file: 'File',
      tweet: 'Tweet',
      drop: 'Drop'
    };
    return labels[type] || type;
  };

  const getNodeContent = (node: Node) => {
    switch (node.type) {
      case 'text':
        const generatedContent = getCurrentDeltaContent(node.data)?.text;
        if (generatedContent) {
          return generatedContent;
        }
        // Fallback to raw text input, then instructions, then no content
        return node.data.text || node.data.instructions || 'No content';
      case 'image':
        return node.data.content?.url ? 'Image attached' : 'No image';
      case 'audio':
        return node.data.transcript || (node.data.content?.url ? 'Audio attached' : 'No audio');
      case 'video':
        return node.data.content?.url ? 'Video attached' : 'No video';
      case 'code':
        const generatedCode = node.data.generated?.text;
        if (generatedCode) {
          return generatedCode;
        }
        // Fallback to instructions if no generated content
        return node.data.instructions || 'No code';
      case 'file':
        return node.data.content?.name || 'No file';
      case 'tweet':
        return node.data.content?.text || 'No tweet content';
      default:
        return 'No content';
    }
  };

  const scrollToNote = (noteId: string) => {
    const element = document.getElementById(`note-${noteId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  return (
    <>
      <MobileHeader projects={projects} currentProjectId={currentProjectId} />
      <div className="h-full overflow-auto">
        <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto min-h-full">
          {/* Top spacing for mobile header */}
          <div className="h-16 flex-shrink-0" />
          
          <div className="sticky top-16 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-[90] pb-4 -mx-4 px-4">
            <h1 className="text-2xl font-semibold">Notes</h1>
            <p className="text-muted-foreground text-sm">
              {nodes.length} {nodes.length === 1 ? 'note' : 'notes'}
            </p>
          </div>
      
      {nodes.map((node) => {
        const connections = getConnectedNotes(node.id);
        const content = getNodeContent(node);
        const isExpanded = expandedNotes.has(node.id);
        const hasLongContent = content.length > 200;
        
        return (
          <Card key={node.id} id={`note-${node.id}`} className="w-full">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {getNodeTypeLabel(node.type || '')}
                  </Badge>
                  {node.data?.title && (
                    <span className="font-medium text-sm">{node.data.title}</span>
                  )}
                </div>
                {hasLongContent && (
                  <button
                    onClick={() => toggleExpanded(node.id)}
                    className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isExpanded ? (
                      <>
                        <span>Less</span>
                        <ChevronRightIcon size={12} />
                      </>
                    ) : (
                      <>
                        <span>More</span>
                        <ChevronDownIcon size={12} />
                      </>
                    )}
                  </button>
                )}
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap mb-3">
                {isExpanded || !hasLongContent ? content : `${content.slice(0, 200)}...`}
              </div>
              
              {connections.length > 0 && (
                <div className="pt-2 border-t">
                  <div className="text-xs text-muted-foreground mb-2">Connected to:</div>
                  <div className="flex flex-wrap gap-1">
                    {connections.map(conn => (
                      <Badge 
                        key={conn.id}
                        variant="secondary" 
                        className="text-xs cursor-pointer hover:bg-secondary/80"
                        onClick={() => scrollToNote(conn.id)}
                      >
                        {conn.direction === 'incoming' ? '← ' : '→ '}
                        {conn.title}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
      
        {nodes.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No notes yet</p>
            <p className="text-muted-foreground text-sm mt-1">
              Switch to desktop to create your first note
            </p>
          </div>
        )}
        
          {/* Bottom spacing to avoid overlapping with any bottom UI elements */}
          <div className="h-16 flex-shrink-0" />
        </div>
      </div>
    </>
  );
};