Feature: Timeline periods
  Year / month / week / day headings follow capture time. The pinned
  label follows the first visible Timeline Group.

  Scenario: Granularity headings include an ISO week range
    Given I am signed in
    When I group memories by "Year"
    Then I should see the period heading "2026"
    When I group memories by "Month"
    Then I should see the period heading "August 2026"
    When I group memories by "Week"
    Then I should see the period heading "31 Aug – 6 Sep 2026"
    And I should see the period heading "24–30 Aug 2026"
    When I go back to today
    And I group memories by "Day"
    Then I should see the period heading "Monday, 31 August 2026"

  Scenario: Current period label follows scroll
    Given I am signed in
    When I group memories by "Day"
    Then the current period should be "Monday, 31 August 2026"
    When I scroll until I see the memory from "Wednesday, 15 March 2023"
    Then the current period should be "Wednesday, 15 March 2023"

  Scenario: Granularity highlight follows the selected option
    Given I am signed in
    When I group memories by "Week"
    Then the granularity highlight should be on "Week"
    When I group memories by "Day"
    Then the granularity highlight should be on "Day"

  @future @skip
  Scenario: Loading more memories shows a spinner
    Given I am signed in
    When I scroll to the end of the timeline
    Then I should see "Loading more memories…"
