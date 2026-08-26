Feature: Sign in
  An owner reaches their library through Dex.

  Scenario: Admin sees memories after login
    Given I am signed in
    Then I should see my memories
