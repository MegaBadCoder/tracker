import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import MarkdownContent from '@/shared/ui/MarkdownContent.vue'

function render(content: string) {
  return mount(MarkdownContent, { props: { content } })
}

describe('markdownContent', () => {
  it('renders named links and bare URLs with safe external navigation', () => {
    const wrapper = render('[Схема](https://github.com/example/schema/pull/5) и https://example.com/client')
    const links = wrapper.findAll('a')
    expect(links).toHaveLength(2)
    expect(links[0]!.text()).toBe('Схема')
    expect(links[0]!.attributes('href')).toBe('https://github.com/example/schema/pull/5')
    expect(links[1]!.attributes('href')).toBe('https://example.com/client')
    for (const link of links) {
      expect(link.attributes('target')).toBe('_blank')
      expect(link.attributes('rel')).toBe('noopener noreferrer')
    }
  })

  it.each(['javascript:alert(1)', 'vbscript:alert(1)', 'data:text/html,test', 'file:///etc/passwd'])('does not create a link for %s', (url) => {
    expect(render(`[Опасная ссылка](${url})`).find('a').exists()).toBe(false)
  })

  it('escapes HTML and encoded unsafe schemes', () => {
    const wrapper = render('<script>alert(1)</script><img src="https://example.com/a" onerror="alert(1)">\n[Ссылка](jav&#x61;script:alert(1))')
    expect(wrapper.find('script').exists()).toBe(false)
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.findAll('a').every(link => link.attributes('href')?.startsWith('https://'))).toBe(true)
    expect(render('[Ссылка](jav&#x61;script:alert(1))').find('a').exists()).toBe(false)
    expect(wrapper.text()).toContain('<script>alert(1)</script>')
  })

  it('preserves line breaks and renders basic formatting, lists and code', () => {
    const wrapper = render('Первая строка\nВторая **важная** строка\n\n- Один\n- Два\n\n`<script>`\n\n```js\nconst n = 1\n```')
    expect(wrapper.find('br').exists()).toBe(true)
    expect(wrapper.find('strong').text()).toBe('важная')
    expect(wrapper.findAll('li').map(item => item.text())).toEqual(['Один', 'Два'])
    expect(wrapper.find('code').text()).toBe('<script>')
    expect(wrapper.find('pre code').text()).toContain('const n = 1')
  })

  it('shows image Markdown as text without loading remote images', () => {
    const wrapper = render('![Схема](https://example.com/private.png)')
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('Схема')
  })

  it('updates the preview when content changes', async () => {
    const wrapper = render('Старое описание')
    await wrapper.setProps({ content: '**Новое описание**' })
    expect(wrapper.find('strong').text()).toBe('Новое описание')
    expect(wrapper.text()).not.toContain('Старое')
  })
})
