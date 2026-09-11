export function GET(request: Request) {
  return Response.redirect(new URL('/planilha', request.url), 307);
}
