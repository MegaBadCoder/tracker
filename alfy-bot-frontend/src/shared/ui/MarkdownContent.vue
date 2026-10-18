<script setup lang="ts">
import MarkdownIt from 'markdown-it'
import { computed } from 'vue'

const props = defineProps<{
  content: string
}>()

const markdown = new MarkdownIt({ html: false, linkify: true, breaks: true })

markdown.renderer.rules.link_open = (tokens, index, options, _env, renderer) => {
  const token = tokens[index]!
  token.attrSet('target', '_blank')
  token.attrSet('rel', 'noopener noreferrer')
  return renderer.renderToken(tokens, index, options)
}

markdown.renderer.rules.image = (tokens, index) => markdown.utils.escapeHtml(tokens[index]!.content)

const rendered = computed(() => markdown.render(props.content))
</script>

<template>
  <div class="markdown-content" v-html="rendered" />
</template>

<style scoped>
.markdown-content {
  overflow-wrap: anywhere;
  line-height: 1.6;
}

.markdown-content :deep(p),
.markdown-content :deep(ul),
.markdown-content :deep(ol),
.markdown-content :deep(pre),
.markdown-content :deep(blockquote) {
  margin-block: 0.65em;
}

.markdown-content :deep(> :first-child) {
  margin-top: 0;
}

.markdown-content :deep(> :last-child) {
  margin-bottom: 0;
}

.markdown-content :deep(a) {
  color: var(--primary);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.markdown-content :deep(a:hover) {
  opacity: 0.8;
}

.markdown-content :deep(ul) {
  padding-left: 1.5em;
  list-style: disc;
}

.markdown-content :deep(ol) {
  padding-left: 1.5em;
  list-style: decimal;
}

.markdown-content :deep(h1),
.markdown-content :deep(h2),
.markdown-content :deep(h3),
.markdown-content :deep(h4),
.markdown-content :deep(h5),
.markdown-content :deep(h6) {
  margin-block: 0.8em 0.35em;
  font-weight: 600;
  line-height: 1.3;
}

.markdown-content :deep(h1) {
  font-size: 1.4em;
}

.markdown-content :deep(h2) {
  font-size: 1.2em;
}

.markdown-content :deep(code) {
  border-radius: 0.25rem;
  padding: 0.1em 0.3em;
  background: var(--muted);
  font-family: monospace;
  font-size: 0.9em;
}

.markdown-content :deep(pre) {
  max-width: 100%;
  overflow-x: auto;
  border-radius: 0.375rem;
  padding: 0.75em;
  background: var(--muted);
}

.markdown-content :deep(pre code) {
  padding: 0;
  background: transparent;
}

.markdown-content :deep(blockquote) {
  border-left: 3px solid var(--border);
  padding-left: 0.8em;
  color: var(--muted-foreground);
}

.markdown-content :deep(table) {
  display: block;
  max-width: 100%;
  overflow-x: auto;
  border-collapse: collapse;
}

.markdown-content :deep(th),
.markdown-content :deep(td) {
  border: 1px solid var(--border);
  padding: 0.35em 0.6em;
}
</style>
