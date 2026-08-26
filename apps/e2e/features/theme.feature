Feature: Light and dark theme
  First visit follows the system. Toggle persists.

  Scenario: First visit follows the system
    Given I have no saved theme
    And I prefer a dark color scheme
    And I am signed in
    Then the library is in dark mode

  Scenario: Toggle switches and persists
    Given I have no saved theme
    And I prefer a light color scheme
    And I am signed in
    Then the library is in light mode
    When I switch the theme
    Then the library is in dark mode
    When I reload the page
    Then the library is in dark mode
