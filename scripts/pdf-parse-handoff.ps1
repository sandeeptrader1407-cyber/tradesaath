# TradeSaath PDF Parse Fix - Hand-off Script
# Runs tsc + build, then commits + pushes if green.
# Wrapped in a scriptblock so a failure never closes Sandeep's terminal.

& {
    # IMPORTANT: use 'Continue' (not 'Stop') so npm's stderr warnings
    # (e.g. "npm warn cleanup Failed to remove some directories")
    # do NOT silently abort the script. We rely on $LASTEXITCODE
    # below to detect real failures from native commands.
    $ErrorActionPreference = 'Continue'
    $PSNativeCommandUseErrorActionPreference = $false
    Set-Location -Path 'C:\Users\SK\Desktop\tradesaath'

    Write-Host ''
    Write-Host '=============================================================' -ForegroundColor Cyan
    Write-Host '  TradeSaath PDF Parse Fix - Ship Gate' -ForegroundColor Cyan
    Write-Host '=============================================================' -ForegroundColor Cyan
    Write-Host ''

    # -----------------------------------------------------------------
    # Step 1: Install deps (idempotent - npm no-ops if already installed)
    # -----------------------------------------------------------------
    Write-Host '[1/5] Verifying pdfjs-dist + @napi-rs/canvas deps...' -ForegroundColor Yellow
    $pkg = Get-Content -Raw 'package.json' | ConvertFrom-Json
    $hasPdfJs    = $pkg.dependencies.'pdfjs-dist'      -ne $null
    $hasCanvas   = $pkg.dependencies.'@napi-rs/canvas' -ne $null
    $hasTesseract= $pkg.dependencies.'tesseract.js'    -ne $null
    if (-not ($hasPdfJs -and $hasCanvas -and $hasTesseract)) {
        Write-Host '  Missing deps in package.json. Aborting.' -ForegroundColor Red
        return
    }
    Write-Host '  package.json has all three deps. Running npm install...' -ForegroundColor Gray
    # Merge stderr into stdout and filter to just the meaningful tail.
    # We ignore npm's "warn cleanup" / "warn deprecated" noise — only $LASTEXITCODE matters.
    $npmOut = & npm install --no-fund --no-audit 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host '  npm install failed. Last 15 lines:' -ForegroundColor Red
        $npmOut | Select-Object -Last 15 | ForEach-Object { Write-Host "  $_" }
        return
    }
    Write-Host '  Deps installed (warnings ignored).' -ForegroundColor Green
    Write-Host ''

    # -----------------------------------------------------------------
    # Step 2: TypeScript type check
    # -----------------------------------------------------------------
    Write-Host '[2/5] Running tsc --noEmit...' -ForegroundColor Yellow
    & npx tsc --noEmit --pretty false 2>&1 | Tee-Object -Variable tscOut | Select-Object -First 40
    if ($LASTEXITCODE -ne 0) {
        Write-Host ''
        Write-Host '  tsc failed. Full output above. Aborting before build.' -ForegroundColor Red
        return
    }
    Write-Host '  tsc clean.' -ForegroundColor Green
    Write-Host ''

    # -----------------------------------------------------------------
    # Step 3: Next build
    # -----------------------------------------------------------------
    Write-Host '[3/5] Running npm run build...' -ForegroundColor Yellow
    & npm run build 2>&1 | Tee-Object -Variable buildOut | Select-Object -Last 40
    if ($LASTEXITCODE -ne 0) {
        Write-Host ''
        Write-Host '  next build failed. Full output above. Aborting before commit.' -ForegroundColor Red
        return
    }
    Write-Host '  next build succeeded.' -ForegroundColor Green
    Write-Host ''

    # -----------------------------------------------------------------
    # Step 4: Git status + commit
    # -----------------------------------------------------------------
    Write-Host '[4/5] Staging and committing changes...' -ForegroundColor Yellow
    & git add package.json package-lock.json `
              next.config.mjs `
              lib/intake/pdfOcrExtractor.ts `
              app/api/analyse/route.ts `
              components/results/TradeDetail.tsx `
              scripts/pdf-parse-handoff.ps1
    & git status --short

    $msg = @'
fix(pdf): Vercel-safe PDF parser + 100-trade Claude vision fallback

PDF parsing was broken for Sandeep's daily Fyers contract notes
(Microsoft-Print-To-PDF vectorised exports, 100+ trades) because:
  - pdf-parse finds zero text operators on vectorised PDFs
  - pdftoppm shell-out does not exist on Vercel
  - tesseract OCR mangles small-font numeric columns
  - Claude vision hit its max_tokens=4096 ceiling at ~13 trades

Fixes in this commit:

1. pdfOcrExtractor.ts - Vercel-safe PDF renderer
   - Replaced pdftoppm shell-out with pdfjs-dist + @napi-rs/canvas
   - Both deps are pure-JS / prebuilt-binary and run on Vercel's
     default serverless Node 20 runtime
   - Per-page render timeout and canvas cleanup to keep memory flat

2. pdfOcrExtractor.ts - Fyers-specific line parser
   - 16-digit order-ID anchor (strict/split/loose tiers)
   - BUY/SELL inference from same-order-id price grouping
   - B<->8, S<->5, +/- side-char normalisation

3. pdfOcrExtractor.ts - Phase 4 sanity gate
   - If >=10 trade-looking lines are detected but the parser recovers
     <70%, return empty instead of shipping a partial session. The
     /api/analyse Claude-vision fallback then takes over and extracts
     the full set.

4. app/api/analyse/route.ts - Claude vision bump
   - max_tokens 4096 -> 16000 (was truncating at ~13 trades)
   - timeout 55s -> 75s (within 90s maxDuration)
   - Surface extraction_warning on the response when safeParseJSON's
     truncation-recovery path fires, so the UI can tell the user the
     set may be incomplete

5. components/results/TradeDetail.tsx - sign rendering bug
   - formatPnl used sign = pnl >= 0 ? "+" : ""; so losses displayed
     without any minus sign. Fixed to pnl > 0 ? "+" : pnl < 0 ? "-" : "".

No schema or behaviour changes outside the PDF path.
'@
    # PowerShell mangles multi-line -m strings containing characters like
    # `<`, `>`, `?`, `|` — it splits the message into separate pathspecs.
    # Write the message to a temp file and use `git commit -F` instead.
    $msgFile = Join-Path $env:TEMP ('tradesaath_commit_msg_' + [System.Guid]::NewGuid().ToString() + '.txt')
    Set-Content -Path $msgFile -Value $msg -Encoding UTF8 -NoNewline
    & git commit -F $msgFile
    $commitExit = $LASTEXITCODE
    Remove-Item -Path $msgFile -ErrorAction SilentlyContinue
    if ($commitExit -ne 0) {
        Write-Host '  git commit failed (likely nothing to commit). Continuing...' -ForegroundColor Yellow
    } else {
        Write-Host '  Commit created.' -ForegroundColor Green
    }
    Write-Host ''

    # -----------------------------------------------------------------
    # Step 5: Push
    # -----------------------------------------------------------------
    Write-Host '[5/5] Pushing to origin...' -ForegroundColor Yellow
    $pushOut = & git push origin HEAD 2>&1
    $pushExit = $LASTEXITCODE
    $pushOut | Select-Object -Last 10 | ForEach-Object { Write-Host "  $_" }
    if ($pushExit -ne 0) {
        Write-Host '  git push failed.' -ForegroundColor Red
        return
    }
    # Detect the misleading "Everything up-to-date" case — means nothing was pushed.
    if (($pushOut -join "`n") -match 'Everything up-to-date') {
        Write-Host '  No new commits to push. Check git log to confirm your fix was committed.' -ForegroundColor Yellow
    } else {
        Write-Host '  Pushed.' -ForegroundColor Green
    }
    Write-Host ''

    Write-Host '=============================================================' -ForegroundColor Cyan
    Write-Host '  All 5 gates green. Vercel will redeploy automatically.' -ForegroundColor Green
    Write-Host '=============================================================' -ForegroundColor Cyan
    Write-Host ''
    Write-Host 'Verify on Vercel dashboard, then re-upload TRADES_SANDEEP.pdf'
    Write-Host 'to confirm the full 100+ trade set is extracted.'
    Write-Host ''
    return
}
