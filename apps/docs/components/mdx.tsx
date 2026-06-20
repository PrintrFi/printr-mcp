import { Popup, PopupContent, PopupTrigger } from 'fumadocs-twoslash/ui';
import { Step, Steps } from 'fumadocs-ui/components/steps';
import { Tab, Tabs } from 'fumadocs-ui/components/tabs';
import defaultMdxComponents from 'fumadocs-ui/mdx';
import type { MDXComponents } from 'mdx/types';
import { SupportedChains } from '@/components/supported-chains';

export function getMDXComponents(components?: MDXComponents) {
  return {
    ...defaultMdxComponents,
    Tab,
    Tabs,
    Step,
    Steps,
    // hover lenses emitted by transformerTwoslash for ```ts twoslash fences
    Popup,
    PopupContent,
    PopupTrigger,
    // supported-chains table generated from @printr/sdk CHAIN_META
    SupportedChains,
    ...components,
  } satisfies MDXComponents;
}

export const useMDXComponents = getMDXComponents;

declare global {
  type MDXProvidedComponents = ReturnType<typeof getMDXComponents>;
}
