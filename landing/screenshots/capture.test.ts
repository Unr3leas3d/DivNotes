// @vitest-environment node

import { mockups } from './capture'

describe('capture screenshot manifest', () => {
  it('defines all seven landing-page screenshots', () => {
    expect(mockups).toHaveLength(7)
    expect(mockups.map((mockup) => mockup.output)).toEqual([
      'popup-dashboard.png',
      'side-panel.png',
      'folders.png',
      'tags.png',
      'cloud-sync.png',
      'element-inspector.png',
      'obsidian-vault.png',
    ])
  })
})
