import { describe, expect, it } from 'vitest'
import { useGroupDetail } from '@/features/projects/model/use-group-detail'

describe('useGroupDetail', () => {
  it('open устанавливает current, close сбрасывает в null', () => {
    const { current, open, close } = useGroupDetail()

    expect(current.value).toBeNull()

    open('proj-1', 'epic-1')
    expect(current.value).toEqual({ projectId: 'proj-1', groupId: 'epic-1' })

    close()
    expect(current.value).toBeNull()
  })

  it('состояние общее между двумя вызовами useGroupDetail()', () => {
    const first = useGroupDetail()
    const second = useGroupDetail()

    first.open('proj-1', 'epic-1')
    expect(second.current.value).toEqual({ projectId: 'proj-1', groupId: 'epic-1' })

    second.close()
    expect(first.current.value).toBeNull()
  })
})
