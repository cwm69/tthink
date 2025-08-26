import Editor from '@monaco-editor/react';
import { useReactFlow } from '@xyflow/react';
import type { ComponentProps } from 'react';
import { useState } from 'react';
import type { CodeNodeProps } from '.';
import { NodeLayout } from '../layout';
import { LanguageSelector } from './language-selector';

type CodePrimitiveProps = CodeNodeProps & {
  title: string;
  width?: number;
  height?: number;
};

export const CodePrimitive = ({
  data,
  id,
  type,
  title,
  width,
  height,
}: CodePrimitiveProps) => {
  const { updateNodeData } = useReactFlow();
  const [isFocused, setIsFocused] = useState(false);

  const handleCodeChange = (value: string | undefined) => {
    updateNodeData(id, {
      content: { text: value, language: data.content?.language },
    });
  };

  const handleLanguageChange = (value: string) => {
    updateNodeData(id, {
      content: { text: data.content?.text, language: value },
    });
  };

  const toolbar: ComponentProps<typeof NodeLayout>['toolbar'] = [
    {
      children: (
        <LanguageSelector
          value={data.content?.language ?? 'javascript'}
          onChange={handleLanguageChange}
          className="w-[200px] rounded-full"
        />
      ),
    },
  ];

  return (
    <div style={{ width: width || 400, height: height || 300 }}>
      <NodeLayout id={id} data={data} title={title} type={type} toolbar={toolbar}>
        <div 
          style={{ width: '100%', height: '100%' }}
          tabIndex={0}
          onFocus={(e) => {
            e.currentTarget.classList.add('nowheel');
            setIsFocused(true);
          }}
          onBlur={(e) => {
            e.currentTarget.classList.remove('nowheel');
            setIsFocused(false);
          }}
          onClick={(e) => {
            e.currentTarget.focus();
            e.stopPropagation();
          }}
        >
          <Editor
            width="100%"
            height="100%"
            language={data.content?.language}
            value={data.content?.text}
            onChange={handleCodeChange}
            theme="vs-dark"
            options={{
              minimap: {
                enabled: false,
              },
              scrollbar: {
                alwaysConsumeMouseWheel: isFocused,
                handleMouseWheel: isFocused,
              },
            }}
          />
        </div>
      </NodeLayout>
    </div>
  );
};
