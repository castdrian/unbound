package main

import (
	"fmt"
	"sort"
	"strings"
	"time"
)

func (watcher *smokeLogWatcher) markLaunch() {
	watcher.mu.Lock()
	defer watcher.mu.Unlock()
	watcher.launchedAt = watcher.now()
	watcher.startup = smokeStartupTimes{}
}

func (watcher *smokeLogWatcher) recordMilestone(milestone *time.Duration) {
	if watcher.launchedAt.IsZero() || *milestone != 0 {
		return
	}
	*milestone = watcher.now().Sub(watcher.launchedAt)
}

func startupBudgetProblems(times smokeStartupTimes, budget smokeStartupBudget, crashes []string) []string {
	if len(crashes) > 0 {
		return nil
	}
	var problems []string
	if problem := milestoneProblem("executing Unbound's bundle", times.bundle, budget.bundle); problem != "" {
		problems = append(problems, problem)
	}
	if problem := milestoneProblem("loading every plugin", times.plugins, budget.plugins); problem != "" {
		problems = append(problems, problem)
	}
	return problems
}

func milestoneProblem(milestone string, took, budget time.Duration) string {
	switch {
	case budget == 0:
		return ""
	case took == 0:
		return fmt.Sprintf("startup never reached %s, which has a %s budget", milestone, budget)
	case took > budget:
		return fmt.Sprintf("startup took %s to reach %s, over its %s budget", roundStartup(took), milestone, budget)
	default:
		return ""
	}
}

func renderStartupTimes(times smokeStartupTimes, budget smokeStartupBudget) string {
	var report strings.Builder
	report.WriteString("| Startup milestone | Time from launch | Budget |\n| --- | --- | --- |\n")
	fmt.Fprintf(&report, "| Unbound's bundle executed | %s | %s |\n", describeStartupTime(times.bundle), describeBudget(budget.bundle))
	fmt.Fprintf(&report, "| Every plugin loaded | %s | %s |\n\n", describeStartupTime(times.plugins), describeBudget(budget.plugins))
	return report.String()
}

func describeStartupTime(took time.Duration) string {
	if took == 0 {
		return "not reached"
	}
	return roundStartup(took).String()
}

func describeBudget(budget time.Duration) string {
	if budget == 0 {
		return "none"
	}
	return budget.String()
}

func roundStartup(took time.Duration) time.Duration {
	return took.Round(100 * time.Millisecond)
}

const slowestStartsShown = 5

func describeStartMs(startMs *float64) string {
	if startMs == nil {
		return "—"
	}
	return fmt.Sprintf("%.0f ms", *startMs)
}

func renderSlowestStarts(statuses []smokePluginStatus) string {
	timed := []smokePluginStatus{}
	for _, status := range statuses {
		if status.StartMs != nil {
			timed = append(timed, status)
		}
	}
	if len(timed) == 0 {
		return ""
	}
	sort.SliceStable(timed, func(left, right int) bool { return *timed[left].StartMs > *timed[right].StartMs })
	total := 0.0
	for _, status := range timed {
		total += *status.StartMs
	}
	names := []string{}
	for _, status := range timed[:min(slowestStartsShown, len(timed))] {
		names = append(names, fmt.Sprintf("`%s` %s", status.ID, describeStartMs(status.StartMs)))
	}
	return fmt.Sprintf("Plugins took %.0f ms to start in total. Slowest: %s.\n\n", total, strings.Join(names, ", "))
}

func pluginStartBudgetProblems(statuses []smokePluginStatus, budget time.Duration) []string {
	if budget == 0 {
		return nil
	}
	limit := float64(budget.Milliseconds())
	problems := []string{}
	for _, status := range statuses {
		if status.StartMs != nil && *status.StartMs > limit {
			problems = append(problems, fmt.Sprintf("%s took %s to start, over the %s plugin start budget", status.ID, describeStartMs(status.StartMs), budget))
		}
	}
	return problems
}
