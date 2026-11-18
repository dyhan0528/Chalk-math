"""index.html 만들기
   python3 build.py                                   # 서버 주소 없이 (배포 주소로 열 때)
   python3 build.py --server https://chalk-math.vercel.app   # 휴대폰 파일로 열 때도 서버에 연결
"""
import os, sys
server = ''
for i, a in enumerate(sys.argv):
    if a == '--server' and i + 1 < len(sys.argv):
        server = sys.argv[i + 1].strip().rstrip('/')
if server and not server.startswith('https://') and not server.startswith('http://localhost'):
    sys.exit('서버 주소는 https:// 로 시작해야 해요: ' + server)
here = os.path.dirname(os.path.abspath(__file__))
def read(n): return open(os.path.join(here, n), encoding='utf-8').read()
t = read('template.html')
core = read('core.js').replace('if (typeof module !== "undefined") module.exports', 'if (typeof module !== "undefined" && module.exports) module.exports')
app = read('app.js')
if '--debug' in sys.argv:
    app = app.replace('requestAnimationFrame(loop);\nfontP', 'if (/debug/.test(location.search)) window.__chalk = { P, seekTo, render, play, pause };\nrequestAnimationFrame(loop);\nfontP')
    out = os.path.join(os.path.dirname(os.path.dirname(here)), 'chalk-math-debug.html')
else:
    out = os.path.join(os.path.dirname(here), 'index.html')
open(out, 'w', encoding='utf-8').write(t.replace('/*SERVER_URL*/', server).replace('/*CORE*/', core).replace('/*APP*/', app))
print('만들었어요:', out, '(서버: ' + (server or '없음') + ')')
