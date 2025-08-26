'use client';

import { Canvas } from '@/components/canvas';
import type { ImageNodeProps } from '@/components/nodes/image';
import type { TextNodeProps } from '@/components/nodes/text';
import { Toolbar } from '@/components/toolbar';
import { Button } from '@/components/ui/button';
import { nodeButtons } from '@/lib/node-buttons';
import { useProject } from '@/providers/project';
import { getIncomers, useReactFlow } from '@xyflow/react';
import { PlayIcon } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';

const TextNode = nodeButtons.find((button) => button.id === 'text');

if (!TextNode) {
  throw new Error('Text node not found');
}

type SimpleWelcomeDemoProps = {
  title: string;
  description: string;
};

export const SimpleWelcomeDemo = ({ title, description }: SimpleWelcomeDemoProps) => {
  const { getNodes, getEdges } = useReactFlow();
  const project = useProject();
  const [started, setStarted] = useState(false);
  const stepsContainerRef = useRef<HTMLDivElement>(null);
  const [hasTextNode, setHasTextNode] = useState(false);
  const [hasFilledTextNode, setHasFilledTextNode] = useState(false);
  const [hasImageNode, setHasImageNode] = useState(false);
  const [hasConnectedImageNode, setHasConnectedImageNode] = useState(false);
  const [hasImageInstructions, setHasImageInstructions] = useState(false);
  const [hasGeneratedImage, setHasGeneratedImage] = useState(false);
  const router = useRouter();

  useEffect(() => {
    // Run on mount to set initial state
    handleNodesChange();
  }, []);

  const handleSkipToCanvas = async () => {
    // Import and call the existing createProjectAction
    const { createProjectAction } = await import('@/app/actions/project/create');
    const response = await createProjectAction('Untitled Project', false);
    
    if ('error' in response) {
      console.error('Error creating project:', response.error);
      return;
    }
    
    router.push(`/projects/${response.id}`);
  };

  const steps = [
    {
      instructions: `${description} Sound good?`,
      action: (
        <div className="not-prose flex items-center gap-4">
          <Button onClick={() => setStarted(true)}>Sounds good!</Button>
          <Button variant="outline" onClick={handleSkipToCanvas}>
            Skip to canvas
          </Button>
        </div>
      ),
      complete: started,
    },
    {
      instructions: (
        <>
          First, click the{' '}
          <TextNode.icon className="-translate-y-0.5 inline-block size-4 text-primary" />{' '}
          icon on the bottom toolbar. This will add a Text node to the canvas.
        </>
      ),
      complete: hasTextNode,
    },
    {
      instructions: (
        <>
          Great! Now click on the Text node you just added and type some text
          into it. Maybe something like "a beautiful sunset".
        </>
      ),
      complete: hasTextNode && hasFilledTextNode,
    },
    {
      instructions: (
        <>
          Next, add an Image node to the canvas by clicking the{' '}
          <span className="inline-flex size-4 items-center justify-center rounded bg-primary/10">
            🖼️
          </span>{' '}
          icon on the bottom toolbar.
        </>
      ),
      complete: hasTextNode && hasFilledTextNode && hasImageNode,
    },
    {
      instructions: (
        <>
          Now, connect the Text node to the Image node by dragging from the
          circle on the right side of the Text node to the circle on the left
          side of the Image node.
        </>
      ),
      complete:
        hasTextNode && hasFilledTextNode && hasImageNode && hasConnectedImageNode,
    },
    {
      instructions: (
        <>
          You're getting the hang of it! Because this node has incoming nodes
          connected to it, it will generate content with AI based on the
          incoming nodes.
          <br />
          <br />
          You can also add instructions to the Image node. This will be used to
          influence the outcome. Try adding some instructions to the Image node,
          maybe something like "make it anime style".
        </>
      ),
      complete:
        hasTextNode &&
        hasFilledTextNode &&
        hasImageNode &&
        hasConnectedImageNode &&
        hasImageInstructions,
    },
    {
      instructions: (
        <>
          That's all the information we need to generate an awesome image! Click
          the Image node to select it, then press the{' '}
          <PlayIcon className="-translate-y-0.5 inline-block size-4 text-primary" />{' '}
          button to generate content.
        </>
      ),
      complete:
        hasTextNode &&
        hasFilledTextNode &&
        hasImageNode &&
        hasConnectedImageNode &&
        hasImageInstructions &&
        hasGeneratedImage,
    },
    {
      instructions: (
        <>
          That's it! You've created your first AI-powered workflow. You can
          continue to add more nodes to a canvas to create more complex flows
          and discover the power of Tersa.
          <br />
          <br />
          <strong>Sign up to save your work and get 200 free credits!</strong>
        </>
      ),
      action: (
        <div className="not-prose flex items-center gap-4">
          <Button asChild>
            <Link href="/auth/sign-up">Sign up to save work</Link>
          </Button>
          <Button variant="outline" onClick={() => {
            // Navigate to the current project to exit the tutorial
            if (project) {
              router.push(`/projects/${project.id}`);
            }
          }}>
            Continue with this project
          </Button>
        </div>
      ),
      complete: false,
    },
  ];

  const activeStep = steps.find((step) => !step.complete) ?? steps[0];
  const previousSteps = steps.slice(0, steps.indexOf(activeStep));

  // biome-ignore lint/correctness/useExhaustiveDependencies: "we want to listen to activeStep"
  useEffect(() => {
    if (stepsContainerRef.current) {
      stepsContainerRef.current.scrollTo({
        top: stepsContainerRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [activeStep.instructions]);

  const handleNodesChange = useCallback(() => {
    setTimeout(() => {
      const newEdges = getEdges();
      const newNodes = getNodes();

      const textNodes = newNodes.filter((node) => node.type === 'text');

      if (!textNodes.length) {
        setHasTextNode(false);
        return;
      }

      setHasTextNode(true);

      const textNode = textNodes.at(0);

      if (!textNode) {
        return;
      }

      const text = (textNode as unknown as TextNodeProps).data.text;

      if (text && text.length > 10) {
        setHasFilledTextNode(true);
      } else {
        setHasFilledTextNode(false);
      }

      const imageNodes = newNodes.filter((node) => node.type === 'image');
      const imageNode = imageNodes.at(0);

      if (!imageNode) {
        setHasImageNode(false);
        return;
      }

      setHasImageNode(true);

      const sources = getIncomers(imageNode, newNodes, newEdges);
      const textSource = sources.find((source) => source.id === textNode.id);

      if (!textSource) {
        setHasConnectedImageNode(false);
        return;
      }

      setHasConnectedImageNode(true);

      const image = imageNode as unknown as ImageNodeProps;
      const instructions = image.data.instructions;

      if (instructions && instructions.length > 5) {
        setHasImageInstructions(true);
      } else {
        setHasImageInstructions(false);
      }

      if (!image.data.generated?.url) {
        setHasGeneratedImage(false);
        return;
      }

      setHasGeneratedImage(true);
      
      // Auto-save for anonymous users
      localStorage.setItem('tersa-anonymous-project', JSON.stringify({
        nodes: newNodes,
        edges: newEdges,
        viewport: { x: 0, y: 0, zoom: 1 },
        lastSaved: new Date().toISOString(),
      }));
    }, 50);
  }, [getNodes, getEdges]);

  return (
    <div className="grid h-screen w-screen grid-rows-3 lg:grid-cols-3 lg:grid-rows-1">
      <div
        className="size-full overflow-auto p-8 lg:p-16"
        ref={stepsContainerRef}
      >
        <div className="prose flex flex-col items-start gap-4">
          <h1 className="font-semibold! text-3xl!">{title}</h1>
          {previousSteps.map((step, index) => (
            <p key={index} className="lead opacity-50">
              {step.instructions}
            </p>
          ))}

          <p className="lead">{activeStep?.instructions}</p>
          {activeStep?.action}
        </div>
      </div>
      <div className="row-span-3 p-8 lg:col-span-2 lg:row-span-1">
        <div className="relative size-full overflow-hidden rounded-3xl border">
          <Canvas onNodesChange={handleNodesChange}>
            {steps[0].complete && <Toolbar />}
          </Canvas>
        </div>
      </div>
    </div>
  );
};