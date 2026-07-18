import { AnalyticsService } from './analytics.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * The CSV serializer is the one piece of report generation with real correctness
 * risk: a product name with a comma or a quote must not shift columns or break
 * the file. RFC-4180 escaping, tested directly.
 */
describe('AnalyticsService.toCsv', () => {
  const service = new AnalyticsService({} as unknown as PrismaService);

  it('joins headers and rows with CRLF line endings', () => {
    const csv = service.toCsv(['A', 'B'], [['1', '2'], ['3', '4']]);
    expect(csv).toBe('A,B\r\n1,2\r\n3,4');
  });

  it('quotes fields containing a comma', () => {
    const csv = service.toCsv(['Product'], [['Shirt, Cotton']]);
    expect(csv).toBe('Product\r\n"Shirt, Cotton"');
  });

  it('doubles embedded quotes', () => {
    const csv = service.toCsv(['Note'], [['He said "hi"']]);
    expect(csv).toBe('Note\r\n"He said ""hi"""');
  });

  it('quotes fields containing newlines', () => {
    const csv = service.toCsv(['Addr'], [['line1\nline2']]);
    expect(csv).toBe('Addr\r\n"line1\nline2"');
  });

  it('renders numbers, booleans and null safely', () => {
    const csv = service.toCsv(['n', 'b', 'x'], [[42, true, null]]);
    expect(csv).toBe('n,b,x\r\n42,true,');
  });

  it('leaves plain values unquoted', () => {
    const csv = service.toCsv(['Product'], [['Cotton Fabric']]);
    expect(csv).toBe('Product\r\nCotton Fabric');
  });
});
