import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Project } from '../../../shared/entities';
import { planProjectMove } from './plan-project-move';

const project = (id: string, parentId: string | null, order: number) => ({ id, parentId, order, userId: 1 }) as Project;
const tree = () => [project('a', null, 0), project('b', null, 1), project('c', 'a', 0), project('d', 'c', 0)];

describe('planProjectMove', () => {
  it('переносит ветку к другому родителю, сохраняя потомков', () => {
    const input = tree();
    const result = planProjectMove(input, 'c', 'b', null);
    expect(result.find(p => p.id === 'c')?.parentId).toBe('b');
    expect(result.find(p => p.id === 'd')?.parentId).toBe('c');
    expect(input.find(p => p.id === 'c')?.parentId).toBe('a');
  });
  it('выносит проект в корень перед указанным соседом', () => {
    const result = planProjectMove(tree(), 'c', null, 'b');
    expect(result.filter(p => p.parentId === null).sort((a,b) => a.order-b.order).map(p => p.id)).toEqual(['a','c','b']);
  });
  it.each(['a', 'c', 'd'])('отклоняет цикл через %s', parent => {
    expect(() => planProjectMove(tree(), 'a', parent, null)).toThrow(BadRequestException);
  });
  it('отклоняет неизвестного или чужого родителя', () => {
    expect(() => planProjectMove(tree(), 'a', 'foreign', null)).toThrow(NotFoundException);
  });
  it('отклоняет якорь с другого уровня', () => {
    expect(() => planProjectMove(tree(), 'b', null, 'c')).toThrow(BadRequestException);
  });
  it('отклоняет отсутствующий переносимый проект', () => {
    expect(() => planProjectMove(tree(), 'foreign', null, null)).toThrow(NotFoundException);
  });
});
