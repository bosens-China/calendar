import { defineConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';

export default defineConfig({
  plugins: [pluginReact()],
  output: {
    assetPrefix: `/calendar`,
  },
  performance: {
    chunkSplit: {
      strategy: 'split-by-module',
    },
  },
  html: {
    title: `日程管理助手`,
    favicon: './src/assets/favicon/favicon-120x120.png',
    meta: [
      {
        name: 'description',
        content:
          '日程管理助手,根据不同角色提供不同标签，来对日程进行归类管理。',
      },

      // <link rel="icon" type="image/png" sizes="16x16" href="/favicon/favicon-16x16.png"/>
      // <link rel="icon" type="image/png" sizes="32x32" href="/favicon/favicon-32x32.png"/>
      // <link rel="icon" type="image/png" sizes="96x96" href="/favicon/favicon-96x96.png"/>
      // <link rel="icon" type="image/png" sizes="192x192" href="/favicon/favicon-192x192.png"/>
      // <link rel="apple-touch-icon" sizes="57x57" href="/favicon/favicon-57x57.png"/>
      // <link rel="apple-touch-icon" sizes="60x60" href="/favicon/favicon-60x60.png"/>
      // <link rel="apple-touch-icon" sizes="72x72" href="/favicon/favicon-72x72.png"/>
      // <link rel="apple-touch-icon" sizes="76x76" href="/favicon/favicon-76x76.png"/>
      // <link rel="apple-touch-icon" sizes="114x114" href="/favicon/favicon-114x114.png"/>
      // <link rel="apple-touch-icon" sizes="120x120" href="/favicon/favicon-120x120.png"/>
      // <link rel="apple-touch-icon" sizes="144x144" href="/favicon/favicon-144x144.png"/>
      // <link rel="apple-touch-icon" sizes="152x152" href="/favicon/favicon-152x152.png"/>
      // <link rel="apple-touch-icon" sizes="180x180" href="/favicon/favicon-180x180.png"/>
    ],
  },
  tools: {
    rspack: {
      plugins: [],
    },
  },
});
