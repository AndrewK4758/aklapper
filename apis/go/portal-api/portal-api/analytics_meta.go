package main

import (
	"strings"
	"time"

	"github.com/AndrewK4758/aklapper/packages/go/kit/analytics"
	portalv1 "github.com/AndrewK4758/aklapper/packages/go/kit/gen/portal/v1"
	"github.com/AndrewK4758/aklapper/packages/go/kit/geoip"
	"github.com/AndrewK4758/aklapper/packages/go/kit/pg"
)

func chooseNonEmptyStr(primary, fallback *string) *string {
	if primary != nil && strings.TrimSpace(*primary) != "" {
		return primary
	}
	return fallback
}

func buildPortalAnalyticsMeta(
	clientIP string,
	clientCtx *portalv1.ClientRequestContext,
	batch *portalv1.IngestAnalyticsRequest,
	fallbackLanding string,
	geoReader *geoip.Reader,
	baseSalt string,
	now time.Time,
	corrID string,
) pg.PortalAnalyticsMeta {
	daySalt := analytics.BuildDailySalt(baseSalt, now)
	ipHash := analytics.HashVisitorIP(clientIP, daySalt)

	userAgent := ""
	referer := ""
	host := ""
	requestURL := ""
	cloudCountry := ""
	cloudRegion := ""
	guestSessionID := ""
	if clientCtx != nil {
		userAgent = strings.TrimSpace(clientCtx.GetUserAgent())
		referer = strings.TrimSpace(clientCtx.GetReferer())
		host = strings.TrimSpace(clientCtx.GetHost())
		requestURL = strings.TrimSpace(clientCtx.GetRequestUrl())
		cloudCountry = strings.TrimSpace(clientCtx.GetCloudCountry())
		cloudRegion = strings.TrimSpace(clientCtx.GetCloudRegion())
		guestSessionID = strings.TrimSpace(clientCtx.GetGuestSessionId())
	}

	visitorHash := analytics.HashVisitorIdentity(clientIP, userAgent, daySalt)
	botResult := analytics.ClassifyBotUserAgent(userAgent)
	logPortalSeam("RULE_DIVERGENCE", "analytics.ingest.bot_classification_branch", map[string]any{
		"branch":        botResult.Branch,
		"isBot":         botResult.IsBot,
		"correlationId": corrID,
	})
	uaProfile := analytics.ParseUserAgentProfile(userAgent)

	geo := geoip.Enrichment{Branch: geoip.BranchAbsentFallback}
	if geoReader != nil {
		geo = geoReader.Lookup(clientIP)
	}
	country := chooseNonEmptyStr(geo.Country, analytics.SanitizeHeaderGeo(cloudCountry))
	region := chooseNonEmptyStr(geo.Region, analytics.SanitizeHeaderGeo(cloudRegion))

	rawRef := referer
	if batch != nil && batch.Referrer != nil && strings.TrimSpace(*batch.Referrer) != "" {
		rawRef = strings.TrimSpace(*batch.Referrer)
	}
	ownHosts := []string{}
	if host != "" {
		ownHosts = append(ownHosts, host)
	}
	normRef := analytics.NormalizeReferrer(rawRef, ownHosts)

	var campaign analytics.CampaignParams
	if requestURL != "" {
		campaign = analytics.ExtractCampaignParams(requestURL)
	} else if fallbackLanding != "" {
		campaign.LandingPath = analytics.NormalizeLandingPath(fallbackLanding)
	}

	landingPathStr := campaign.LandingPath
	if batch != nil && batch.LandingPath != nil && strings.TrimSpace(*batch.LandingPath) != "" {
		landingPathStr = analytics.NormalizeLandingPath(*batch.LandingPath)
	} else if landingPathStr == "" && fallbackLanding != "" {
		landingPathStr = analytics.NormalizeLandingPath(fallbackLanding)
	}
	var landingPathPtr *string
	if landingPathStr != "" {
		landingPathPtr = &landingPathStr
	}

	refParam := campaign.RefParam
	utmSource := campaign.UTMSource
	utmMedium := campaign.UTMMedium
	utmCampaign := campaign.UTMCampaign
	utmContent := campaign.UTMContent
	if batch != nil {
		if batch.RefParam != nil {
			refParam = chooseNonEmptyStr(analytics.SanitizeCampaignValue(*batch.RefParam), refParam)
		}
		if batch.UtmSource != nil {
			utmSource = chooseNonEmptyStr(analytics.SanitizeCampaignValue(*batch.UtmSource), utmSource)
		}
		if batch.UtmMedium != nil {
			utmMedium = chooseNonEmptyStr(analytics.SanitizeCampaignValue(*batch.UtmMedium), utmMedium)
		}
		if batch.UtmCampaign != nil {
			utmCampaign = chooseNonEmptyStr(analytics.SanitizeCampaignValue(*batch.UtmCampaign), utmCampaign)
		}
		if batch.UtmContent != nil {
			utmContent = chooseNonEmptyStr(analytics.SanitizeCampaignValue(*batch.UtmContent), utmContent)
		}
	}

	var guestPtr *string
	if guestSessionID != "" {
		guestPtr = &guestSessionID
	}
	devType := uaProfile.DeviceType
	refCat := normRef.ReferrerCategory

	return pg.PortalAnalyticsMeta{
		IPHash:           ipHash,
		VisitorHash:      visitorHash,
		IsBot:            botResult.IsBot,
		GuestSessionID:   guestPtr,
		Country:          country,
		Region:           region,
		City:             geo.City,
		Timezone:         geo.Timezone,
		ASN:              geo.ASN,
		ASNOrg:           geo.ASNOrg,
		Referrer:         normRef.Referrer,
		ReferrerHost:     normRef.ReferrerHost,
		ReferrerCategory: &refCat,
		LandingPath:      landingPathPtr,
		RefParam:         refParam,
		UTMSource:        utmSource,
		UTMMedium:        utmMedium,
		UTMCampaign:      utmCampaign,
		UTMContent:       utmContent,
		DeviceType:       &devType,
		OSName:           uaProfile.OSName,
		BrowserName:      uaProfile.BrowserName,
	}
}

func protoEventsToStoreInputs(events []*portalv1.AnalyticsEvent) []pg.PortalAnalyticsEventInput {
	out := make([]pg.PortalAnalyticsEventInput, 0, len(events))
	for _, ev := range events {
		meta := make(map[string]any, len(ev.GetMetadata()))
		for k, v := range ev.GetMetadata() {
			if v == nil {
				continue
			}
			switch kind := v.Kind.(type) {
			case *portalv1.AnalyticsMetadataValue_StringValue:
				meta[k] = kind.StringValue
			case *portalv1.AnalyticsMetadataValue_NumberValue:
				meta[k] = kind.NumberValue
			case *portalv1.AnalyticsMetadataValue_BoolValue:
				meta[k] = kind.BoolValue
			}
		}
		out = append(out, pg.PortalAnalyticsEventInput{
			Type:      ev.GetType(),
			Name:      ev.GetName(),
			Path:      ev.GetPath(),
			Value:     ev.Value,
			Metadata:  meta,
			Timestamp: ev.GetTimestamp(),
		})
	}
	return out
}
