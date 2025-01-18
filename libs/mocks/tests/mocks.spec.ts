import { mockReqObj, mockRespObj } from '../src/lib/mocks.ts';

describe('mocks', () => {
  it('should work', () => {
    expect(mockReqObj()).toBeTruthy();
    expect(mockRespObj()).toBeTruthy();
  });
});
