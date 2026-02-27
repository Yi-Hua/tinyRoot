import { TestBed } from '@angular/core/testing';

import { Invoice } from './invoice.service';

describe('Invoice', () => {
  let service: Invoice;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Invoice);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
