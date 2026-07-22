# Health Check - Live Site
Write-Host "=== LIVE SITE CHECK ==="
try {
    $response = Invoke-WebRequest -Uri 'https://c-21-1.onrender.com/' -UseBasicParsing -TimeoutSec 120
    Write-Host "Status Code: $($response.StatusCode)"
    Write-Host "Content Length: $($response.Content.Length) chars"
    Write-Host "RESULT: PASS"
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    Write-Host "RESULT: FAIL"
}

Write-Host ""
Write-Host "=== SCRAPER API CHECK ==="
try {
    $body = @{ url = 'https://www.zonaprop.com.ar/propiedades/clasificado/veclapin-departamento-venta-3-ambientes-con-dependencia-y-58298310.html' } | ConvertTo-Json
    $apiResponse = Invoke-WebRequest -Uri 'https://c-21-1.onrender.com/api/scrape' -Method POST -Body $body -ContentType 'application/json' -UseBasicParsing -TimeoutSec 120
    Write-Host "Status Code: $($apiResponse.StatusCode)"
    $data = $apiResponse.Content | ConvertFrom-Json
    
    $hasTitle = [bool]$data.title
    $hasPrice = [bool]$data.price
    $hasLocation = [bool]$data.location
    $hasFeatures = [bool]$data.features
    $hasImages = [bool]$data.images

    Write-Host "Title: $($data.title)"
    Write-Host "Price: $($data.price)"
    Write-Host "Location: $($data.location)"
    Write-Host "Features count: $(if($data.features){$data.features.Count}else{'N/A'})"
    Write-Host "Images count: $(if($data.images){$data.images.Count}else{'N/A'})"
    
    if ($hasTitle -and $hasPrice -and $hasLocation) {
        Write-Host "RESULT: PASS - Core fields present"
    } else {
        Write-Host "RESULT: PARTIAL - Missing some fields"
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "Response Body: $responseBody"
    }
    Write-Host "RESULT: FAIL"
}
