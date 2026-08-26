Feature: Index run splash
  Syncing the folder shows the Index run splash, then returns to
  Memories.

  Scenario: Sync folder shows the Index run then memories
    Given I am signed in
    When I start a folder sync
    Then I should see the Index run splash
    And I should see my memories

  @future @skip
  Scenario: A failed Index run can be retried
    Given the Index run has failed
    When I am signed in
    Then I should see the Index run splash
    When I retry the Index run
    Then I should see my memories
