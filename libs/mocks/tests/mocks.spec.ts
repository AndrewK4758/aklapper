import { mockReqObj, mockRespObj } from '../src/lib/mocks.js';

describe('mocks', () => {
  it('should work', () => {
    expect(mockReqObj()).toBeTruthy();
    expect(mockRespObj()).toBeTruthy();
  });
});
