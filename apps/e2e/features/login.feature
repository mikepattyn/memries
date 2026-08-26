Feature: Sign in
  Dex login puts the owner on Memories.

  Scenario: Admin sees memories after login
    Given I am signed in
    Then I should see my memories
