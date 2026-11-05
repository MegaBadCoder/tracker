import { createsDependencyCycle } from './task-dependency';

describe('createsDependencyCycle', () => {
  const edges = [
    { taskId: 'b', dependencyId: 'a' },
    { taskId: 'c', dependencyId: 'b' },
  ];

  it('rejects self dependency', () => {
    expect(createsDependencyCycle('a', ['a'], [])).toBe(true);
  });

  it('rejects a direct cycle', () => {
    expect(createsDependencyCycle('a', ['b'], edges)).toBe(true);
  });

  it('rejects a transitive cycle', () => {
    expect(createsDependencyCycle('a', ['c'], edges)).toBe(true);
  });

  it('allows a diamond and replacing existing predecessors', () => {
    expect(createsDependencyCycle('c', ['a', 'b'], edges)).toBe(false);
    expect(createsDependencyCycle('b', [], edges)).toBe(false);
  });

  it('handles deep graphs without recursive stack growth', () => {
    const chain = Array.from({ length: 12000 }, (_, i) => ({
      taskId: String(i + 1),
      dependencyId: String(i),
    }));
    expect(createsDependencyCycle('0', ['12000'], chain)).toBe(true);
  });
});
