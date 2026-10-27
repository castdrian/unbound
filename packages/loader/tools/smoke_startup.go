package main

import (
	"fmt"
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
